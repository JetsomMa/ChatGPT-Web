import axios from 'axios'
import { Midjourney } from '../midjourney'
import type { ChatMessage } from '../chatgpt'
import { chatReplyProcess } from '../chatgpt'
import { sqlDB } from '../utils'
import type { MJMessage } from '../midjourney/interfaces/message'

const client = new Midjourney({
  ServerId: <string>process.env.SERVER_ID,
  ChannelId: <string>process.env.CHANNEL_ID,
  SalaiToken: <string>process.env.SALAI_TOKEN,
  Debug: false,
  Ws: true,
})

export async function replyMidjourney(prompt, dbRecord, res) {
  try {
    res.write(`\n${JSON.stringify({ text: '图片生成中，请稍后...' })}`)

    let response: MJMessage | undefined
    let finalName = 'imagine'
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
            <string>mjdata.id,
            <string>mjdata.hash,
            (uri: string, progress: string) => {
              console.log('loading', uri, 'progress', progress)
              res.write(`\n${JSON.stringify({ text: `[${progress}]图片生成中\n![](${uri})` })}`)
            },
          )
        }
        else if (finalName === 'upscale') {
          response = await client.Upscale(
            mjdata.content,
            index,
            <string>mjdata.id,
            <string>mjdata.hash,
            (uri: string, progress: string) => {
              console.log('loading', uri, 'progress', progress)
              res.write(`\n${JSON.stringify({ text: `[${progress}]图片生成中\n![](${uri})` })}`)
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
      let myChat: ChatMessage | undefined
      await chatReplyProcess({
        message: prompt,
        process: (chat: ChatMessage) => {
          myChat = chat
        },
        systemMessage: 'Please play the role of a translator and translate the following content into English, do not write explanations.',
        temperature: 0,
      })

      const newPrompt = myChat.text
      console.warn('newPrompt -> ', newPrompt)
      response = await client.Imagine(
        newPrompt,
        (uri: string, progress: string) => {
          console.log('loading', uri, 'progress', progress)
          res.write(`\n${JSON.stringify({ text: `[${progress}]图片生成中\n![](${uri})` })}`)
        },
      )
    }

    console.warn('response -> ', response)

    if (response.progress === 'done') {
      console.warn('response.uri -> ', response.uri)

      const fileName = `mj_${dbRecord.telephone}_${new Date().getTime()}.png`
      const resp: any = await axios.post('http://118.195.236.91:3011/api/downloadImage', { imageUrl: response.uri, fileName })
      if (resp.status !== 200) {
        res.write(`\n${JSON.stringify({ text: resp.message })}`)
        return
      }
      response.localurl = `https://download.mashaojie.cn/images/dalle/${fileName}`

      await sqlDB.insert('mjdata', { ...response, prompt, username: dbRecord.username, telephone: dbRecord.telephone })

      // const resultText = `图片生成完毕\n![](${response.localurl})[下载文件](${response.localurl})\n\n`
      const resultText = `![${finalName}](${response.localurl})`
      res.write(`\n${JSON.stringify({ text: resultText })}`)

      dbRecord.conversation = resultText
      dbRecord.conversationId = response.localurl
      dbRecord.finish_reason = 'stop'
    }
    else {
      res.write(`\n${JSON.stringify({ text: '图片生成失败！！！' })}`)
      dbRecord.conversationId = `图片生成_${dbRecord.username}_${dbRecord.telephone}`
    }
  }
  catch (error) {
    res.write(JSON.stringify({ message: error.message }))
  }
}
