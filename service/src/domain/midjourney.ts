import axios from 'axios'
import { Midjourney } from '../midjourney'
import type { ChatMessage } from '../chatgpt'
import { chatReplyProcess } from '../chatgpt'
import { sqlDB } from '../utils'
import type { MJMessage } from '../midjourney/interfaces/message'

const client = new Midjourney({
  ServerId: process.env.SERVER_ID as string,
  ChannelId: process.env.CHANNEL_ID as string,
  SalaiToken: process.env.SALAI_TOKEN as string,
  Debug: false,
  Ws: true,
})

client.init()

const blackKeyWords = ['性爱', '性交', '萝莉', '裸体', '习近平']
export async function replyMidjourney(prompt, dbRecord, res, chatusername = '') {
  try {
    let oldurl = ''
    res && res.write(`\n${JSON.stringify({ text: '准备生成图片，请耐心等待...[如果长时间不生成内容，可能是因为输入中包含敏感词导致任务被拦截！]' })}`)

    let response: MJMessage | undefined
    let finalName = 'imagine'
    const telephoneReverse = dbRecord.telephone.split('').reverse().join('')
    const finalFileName = `mj_${telephoneReverse.slice(8) + telephoneReverse.slice(4, 8) + telephoneReverse.slice(0, 4)}_${new Date().getTime()}.png`

    prompt = prompt.replace(/\n/mg, ' ').replace(/\r/mg, ' ')
    if (prompt.startsWith('variation') || prompt.startsWith('upscale')) {
      const promptArray = prompt.split(',')
      finalName = promptArray[0]
      const localurl = promptArray[1]
      const index = Number(promptArray[2])
      const mjdataList = await sqlDB.select('mjdata', { where: { localurl } })
      if (mjdataList.length) {
        const mjdata = mjdataList[0]
        if (finalName === 'variation') {
          response = await client.Variation(
            mjdata.content,
            index,
            mjdata.id as string,
            mjdata.hash as string,
            async (uri: string, progress: string) => {
              console.warn('loading', progress, uri)
              if (oldurl !== uri) {
                oldurl = uri
                await saveTmpPicture(uri, finalFileName, res, progress)
              }
            },
          )
        }
        else if (finalName === 'upscale') {
          response = await client.Upscale(
            mjdata.content,
            index,
            mjdata.id as string,
            mjdata.hash as string,
            async (uri: string, progress: string) => {
              console.warn('loading', progress, uri)
              if (oldurl !== uri) {
                oldurl = uri
                await saveTmpPicture(uri, finalFileName, res, progress)
              }
            },
          )
        }
        else {
          res.write(`\n${JSON.stringify({ text: '未识别的图片生成操作!' })}`)
        }
      }
      else {
        res.write(`\n${JSON.stringify({ text: '未查到历史图片信息!' })}`)
      }
    }
    else {
      if (blackKeyWords.some(key => prompt.includes(key))) {
        res && res.write(`\n${JSON.stringify({ text: '输入中包含敏感词导致任务被拦截！' })}`)
        return
      }

      let newPrompt = ''
      if (prompt.startsWith('http'))
        newPrompt = prompt.split(' ')[0]

      if (/[\u4E00-\u9FA5]/.test(prompt)) {
        let myChat: ChatMessage | undefined
        await chatReplyProcess({
          message: prompt,
          process: (chat: ChatMessage) => {
            myChat = chat
          },
          systemMessage: 'Please play the role of a translator and translate the following content into English, do not write explanations.',
          temperature: 0,
        })

        newPrompt = `${newPrompt} ${myChat.text}`
      }
      else {
        newPrompt = prompt
      }

      console.warn('newPrompt -> ', newPrompt)
      response = await client.Imagine(
        newPrompt,
        async (uri: string, progress: string) => {
          console.warn('loading', progress, uri)
          if (oldurl !== uri) {
            oldurl = uri
            await saveTmpPicture(uri, finalFileName, res, progress)
          }
        },
      )
    }

    console.warn('response -> ', response)

    if (response.progress === 'done') {
      const resp: any = await axios.post('http://118.195.236.91:3011/api/downloadImage', { imageUrl: response.uri, fileName: finalFileName })
      if (resp.status !== 200) {
        res && res.write(`\n${JSON.stringify({ text: resp.message })}`)
        return
      }
      response.localurl = `https://download.mashaojie.cn/images/dalle/${finalFileName}`

      await sqlDB.insert('mjdata', { ...response, prompt, username: dbRecord.username, telephone: dbRecord.telephone })

      const resultText = `![${finalName}](${response.localurl})`
      res && res.write(`\n${JSON.stringify({ text: resultText, finish: true })}`)

      if (res) {
        dbRecord.conversation = resultText
        dbRecord.conversationId = response.localurl
        dbRecord.finish_reason = 'stop'
      }
      else {
        dbRecord.conversation = response.localurl
        dbRecord.conversationId = response.localurl
        dbRecord.finish_reason = 'stop'
      }

      try {
        axios.post('http://118.195.236.91:3012/api/mdj', { username: dbRecord.username, url: response.localurl, chatusername })
        // axios.post('http://127.0.0.1:3012/api/mdj', { username: dbRecord.username, url: response.localurl, chatusername })
      }
      catch (error) {
        console.error(error)
      }

      return response.localurl
    }
    else {
      res && res.write(`\n${JSON.stringify({ text: `图片生成失败！！！${JSON.stringify(response)}\n请联系管理员，微信：18514665919\n![](https://chat.mashaojie.cn/download/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)` })}`)
      return `error: ${JSON.stringify(response)}`
    }
  }
  catch (error) {
    res && res.write(`\n${JSON.stringify({ text: `图片生成失败！！！${JSON.stringify(error.message)}\n请联系管理员，微信：18514665919\n![](https://chat.mashaojie.cn/download/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)` })}`)
    console.warn('replyMidjourney -> ', error)
    return `error: ${error.message}`
  }
}

async function saveTmpPicture(uri, finalFileName, res, progress) {
  const resp: any = await axios.post('http://118.195.236.91:3011/api/downloadImage', { imageUrl: uri, fileName: finalFileName })
  if (resp.status !== 200) {
    res && res.write(`\n${JSON.stringify({ text: resp.message })}`)
    return
  }
  const localurl = `https://download.mashaojie.cn/images/dalle/${finalFileName}?date=${new Date().getTime()}`

  const resultText = `[${progress}]图片生成中，请耐心等待...\n\n![progress](${localurl})`
  res && res.write(`\n${JSON.stringify({ text: resultText })}`)
}
