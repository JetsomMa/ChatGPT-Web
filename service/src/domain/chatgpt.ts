import type { ChatMessage } from '../chatgpt'
import { chatReplyProcess } from '../chatgpt'
import { systemMessagePix } from '../utils/index'

export async function replyChatGPT(prompt, dbRecord, res, options, systemMessage, temperature) {
  try {
    systemMessage = `${systemMessagePix}${systemMessage}。`

    let firstChunk = true
    let myChat: any | undefined
    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        if (firstChunk) {
          res.write(JSON.stringify(chat))
          firstChunk = false
        }
        else {
          res.write(`\n${JSON.stringify(chat)}`)
        }

        myChat = chat
      },
      systemMessage,
      temperature,
    }, dbRecord.querymethod)

    myChat.finish = true
    res.write(`\n${JSON.stringify(myChat)}`)

    if (myChat) {
      console.error('myChat.detail.usage.total_tokens', myChat.detail.usage.total_tokens)

      dbRecord.totaltokens = myChat.detail.usage.total_tokens
      if (dbRecord.querymethod === 'ChatGPT4')
        dbRecord.tokenspay = dbRecord.totaltokens * 0.6 / 1000.0
			 else if (dbRecord.querymethod === 'ChatGPT16K')
        dbRecord.tokenspay = dbRecord.totaltokens * 0.04 / 1000.0
			 else
        dbRecord.tokenspay = dbRecord.totaltokens * 0.02 / 1000.0

      dbRecord.conversation = myChat.text
      dbRecord.conversationId = myChat.id
      dbRecord.finish_reason = myChat.detail.choices[0].finish_reason
    }
  }
  catch (error) {
    res.write(JSON.stringify({ message: `${error.message}\n请联系管理员，微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)` }))
  }
}
