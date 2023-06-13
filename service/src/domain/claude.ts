import { Authenticator } from '../claude/index'
import type { ChatResponse } from '../claude/types'

const token = process.env.CLAUDE_TOKEN
const bot = process.env.CLAUDE_BOT
const authenticator = new Authenticator(token, bot)
// 创建一个频道，已存在则直接返回频道ID
let channel

export async function replyClaude(prompt, dbRecord, res) {
  try {
    if (!channel)
      channel = await authenticator.newChannel('gpt-nlp')

    let firstChunk = true
    const myChat: ChatResponse = await authenticator.sendMessage({
      text: prompt,
      channel,
      conversationId: `claude_${dbRecord.telephone}`,
      onMessage: (chat: ChatResponse) => {
        if (firstChunk) {
          res.write(JSON.stringify(chat))
          firstChunk = false
        }
        else {
          res.write(`\n${JSON.stringify(chat)}`)
        }
      },
    })

    myChat.finish = true
    res.write(`\n${JSON.stringify(myChat)}`)

    if (myChat) {
      dbRecord.conversation = myChat.text
      dbRecord.conversationId = myChat.conversationId
      dbRecord.finish_reason = 'stop'
    }
  }
  catch (error) {
    res.write(JSON.stringify({ message: `${error.message}\n请联系管理员，微信：18514665919\n![](https://chat.mashaojie.cn/download/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)` }))
  }
}
