import type { ChatMessage } from '../chatgpt'
import { chatReplyProcess } from '../chatgpt'
import { systemMessagePix } from '../utils/index'

export async function replyChatGPT(prompt, dbRecord, res, options, systemMessage, temperature) {
  try {
    systemMessage = `${systemMessagePix}${systemMessage}。`

    let firstChunk = true
    let myChat: ChatMessage | undefined
    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        if (firstChunk) {
          chat.text = `${chat.text}`
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
    })

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
