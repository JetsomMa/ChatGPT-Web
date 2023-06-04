import fetch from 'node-fetch'
import axios from 'axios'
import type { ChatMessage } from '../chatgpt'
import { chatReplyProcess } from '../chatgpt'

const systemMessage = `您将扮演一个指令生成器的角色，请保持严谨，不要伪造信息。按照我提供的接口说明生成指令输出，如果指令转换失败则输出"Error"，不要有额外的解释和说明：

以下是接口说明，其中&matrix&代表矩阵，其输入格式为“{{a,b}{c,d}}”或者“(a,b;c,d)”，输出格式必须是{{a,b}{c,d}}：
1、矩阵幂运算：matrixpower(&matrix&,n)
2、矩阵行列式：det &matrix&
3、矩阵LU分解：LU decomposition &matrix&
4、矩阵加、减、乘：&matrix& + &matrix2&、&matrix& - &matrix2&、&matrix& . &matrix2&
5、矩阵向量积：&matrix& . {x, y, z}
6、矩阵的迹：tr &matrix&
7、矩阵行简化：row reduce &matrix&
8、矩阵对角化：diagonalize &matrix&
9、矩阵特征值：eigenvalues &matrix&
10、矩阵特征向量：eigenvectors &matrix&
11、矩阵特征多项式：characteristic polynomial &matrix&
12、矩阵奇异值分解：SVD &matrix&
13、矩阵的逆：inverse &matrix&
14、矩阵的转置：transpose &matrix&
15、矩阵的秩：rank &matrix&
16、矩阵的零：nullity &matrix&
17、矩阵的辅助：adjugate &matrix&
18、nxn希尔伯特矩阵：nxn Hilbert matrix
19、nxn反射矩阵：reflect across a + b + ... + n = 1

以下是一些指令生成的示例：

输入：(1,2,6;3,4,7;8,9,10)的5次幂
输出：matrixpower({{1, 2, 6}, {3, 4, 7}, {8, 9, 10}},5)

输入：{{4, 1}, {2, -1}}的特征多项式
输出：characteristic polynomial {{4, 1}, {2, -1}}

输入：(4,3;5,-2)加{{2, -3}, {-5, 8}}
输出：{{4, 3}, {5, -2}} + {{2, -3}, {-5, 8}}

输入：5x5希尔伯特矩阵
输出：5x5 Hilbert matrix
`
// 输入：4x4反射矩阵
// 输出：reflect across a + b + c + d = 1

async function executeCommand(prompt, dbRecord) {
  try {
    let myChat: ChatMessage | undefined

    await chatReplyProcess({
      message: prompt,
      process: (chat: ChatMessage) => {
        myChat = chat
      },
      systemMessage,
      temperature: 0,
    })

    const command = myChat.text

    console.log('command --> ', command)

    if (command === 'Error') {
      return 'error: 指令转换失败, 请检查你的输入！'
    }
    else {
      const url = `https://api.wolframalpha.com/v2/query?appid=59PXUT-YTTHVPWVVP&includepodid=Result&output=json&format=image,moutput&input=${encodeURIComponent(command)}&podstate=Step‐by‐step`
      console.log('url --> ', url)
      const response = await fetch(url)
      const json: any = await response.json()
      console.log('json --> ', json)
      if (json.queryresult.error)
        return `error: 运算失败: ${json.queryresult.error.msg}`

      const pod = json.queryresult.pods[0]
      if (pod && pod.id === 'Result' && pod.subpods && pod.subpods.length > 0) {
        const subpod = pod.subpods[0]
        if (subpod.img.src) {
          const fileName = `wolframalpha_${dbRecord.telephone}_${new Date().getTime()}.png`
          const resp: any = await axios.post('http://118.195.236.91:3011/api/downloadImage', { imageUrl: subpod.img.src, fileName })
          if (resp.status !== 200)
            return `error: 文件保存错误${resp.message}`

          return `image: https://chat.mashaojie.cn/download/images/dalle/${fileName}\ntext: ${subpod.moutput}`
        }
        else {
          return `text: ${subpod.moutput}`
        }
      }
      else {
        return 'error: 运算结果解析失败！'
      }
    }
  }
  catch (error) {
    return `error: 指令执行失败：${error.message}`
  }
}

// const replySystemMessage = '请你扮演一个数学老师，请将问题和结果中的text做整合，只描述步骤，不描述计算过程，最终将结果中的image图片和text文本分别转换成markdown格式输出。'
const replySystemMessage = '请你扮演一个数学老师，请将问题和结果中的text做整合，只描述步骤，不描述计算过程，最终将结果中的image图片和text文本整理成markdown格式输出。'
export async function replyWolframalpha(prompt, dbRecord, res, options) {
  const result = await executeCommand(prompt, dbRecord)
  if (result.startsWith('error:')) {
    dbRecord.conversation = result
    dbRecord.finish_reason = 'stop'
    res.write(JSON.stringify({ message: dbRecord.conversation }))
  }
  else {
    try {
      let firstChunk = true
      let myChat: any | undefined
      await chatReplyProcess({
        message: `问题：${prompt}\n\n结果：${result}`,
        lastContext: options,
        process: (chat: ChatMessage) => {
          res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
          firstChunk = false
          myChat = chat
        },
        systemMessage: replySystemMessage,
        temperature: 0,
      })

      myChat.finish = true
      res.write(`\n${JSON.stringify(myChat)}`)

      if (myChat) {
        dbRecord.conversation = myChat.text
        dbRecord.conversationId = myChat.id
        dbRecord.finish_reason = myChat.detail.choices[0].finish_reason
      }
    }
    catch (error) {
      res.write(JSON.stringify({ message: error.message }))
    }
  }
}
