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
  Debug: true,
})

export async function replyMidjourney(prompt, dbRecord, res) {
  try {
    res.write(`\n${JSON.stringify({ text: '准备生成图片，请耐心等待...' })}`)

    let response: MJMessage | undefined
    let finalName = 'imagine'
    const finalFileName = `mj_${dbRecord.telephone}_${new Date().getTime()}.png`

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
            async (uri: string) => {
              console.warn('loading', uri)
              await saveTmpPicture(uri, finalFileName, res)
              // res.write(`\n${JSON.stringify({ text: `[进行中...]图片生成中，请耐心等待...\n![](${uri})` })}`)
            },
          )
        }
        else if (finalName === 'upscale') {
          response = await client.Upscale(
            mjdata.content,
            index,
            <string>mjdata.id,
            <string>mjdata.hash,
            async (uri: string) => {
              console.warn('loading', uri)
              await saveTmpPicture(uri, finalFileName, res)
              // res.write(`\n${JSON.stringify({ text: `[进行中...]图片生成中，请耐心等待...\n![](${uri})` })}`)
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
        async (uri: string) => {
          console.warn('loading', uri)
          await saveTmpPicture(uri, finalFileName, res)
          // res.write(`\n${JSON.stringify({ text: `[进行中...]图片生成中，请耐心等待...\n![](${uri})` })}`)
        },
      )
    }

    console.warn('response -> ', response)

    if (response.progress === 'done') {
      console.warn('response.uri -> ', response.uri)

      const resp: any = await axios.post('http://118.195.236.91:3011/api/downloadImage', { imageUrl: response.uri, fileName: finalFileName })
      if (resp.status !== 200) {
        res.write(`\n${JSON.stringify({ text: resp.message })}`)
        return
      }
      response.localurl = `https://download.mashaojie.cn/images/dalle/${finalFileName}`

      await sqlDB.insert('mjdata', { ...response, prompt, username: dbRecord.username, telephone: dbRecord.telephone })

      const resultText = `![${finalName}](${response.localurl})`
      res.write(`\n${JSON.stringify({ text: resultText, finish: true })}`)

      dbRecord.conversation = resultText
      dbRecord.conversationId = response.localurl
      dbRecord.finish_reason = 'stop'
    }
    else {
      res.write(`\n${JSON.stringify({ text: `图片生成失败！！！${JSON.stringify(response)}\n请联系管理员，微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)` })}`)
      dbRecord.conversationId = `图片生成_${dbRecord.username}_${dbRecord.telephone}`
    }
  }
  catch (error) {
    res.write(JSON.stringify({ message: `${error.message}\n请联系管理员，微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)` }))
    throw new Error(error)
  }
}

async function saveTmpPicture(uri, finalFileName, res) {
  const resp: any = await axios.post('http://118.195.236.91:3011/api/downloadImage', { imageUrl: uri, fileName: finalFileName })
  if (resp.status !== 200) {
    res.write(`\n${JSON.stringify({ text: resp.message })}`)
    return
  }
  const localurl = `https://download.mashaojie.cn/images/dalle/${finalFileName}?date=${new Date().getTime()}`

  const resultText = `[进行中...]图片生成中，请耐心等待...\n\n![progress](${localurl})`
  res.write(`\n${JSON.stringify({ text: resultText })}`)
}
