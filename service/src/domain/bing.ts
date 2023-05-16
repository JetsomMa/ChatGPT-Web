import { oraPromise } from 'ora'
import { BingChat } from '../class/bing-chat'
import { sqlDB } from '../utils'

export async function replyBing(prompt, dbRecord, res) {
  try {
    const bingCookieList = await sqlDB.select('keyvalue', { where: { key: 'bing_cookie' } })

    if (bingCookieList.length === 0) {
      res.write(JSON.stringify({ message: '浏览器cookie缺失，请联系管理员！微信：18514665919' }))
    }
    else {
      res.write(`\n${JSON.stringify({ text: '浏览器查询中，请稍后...' })}`)
      const bingCookie = bingCookieList[0].value
      const api = new BingChat({ cookie: bingCookie, debug: true })

      const myChat = await oraPromise(api.sendMessage(prompt, { variant: 'Creative' }), {
        text: prompt,
      })

      if (myChat) {
        let cankaostring = ''
        if (myChat.detail.sourceAttributions) {
          for (let i = 0; i < myChat.detail.sourceAttributions.length; i++) {
            const source = myChat.detail.sourceAttributions[i]
            cankaostring += `[${source.providerDisplayName}](${source.seeMoreUrl})\n`
          }
        }

        const regex = /\[[^\]]+\]\([^)]+\)/g
        myChat.role = 'assistant'
        myChat.text = myChat.text.replace(/\[\^\d\^\]/g, '').replace(regex, '')
        if (cankaostring)
          myChat.text = `${myChat.text}\n\n` + `参考资料：\n${cankaostring}`

        const myChatText = myChat.text
        let index = 0
        const myChatTextLenth = myChatText.length

        console.log('-------------- myChatText --------------')
        console.log(myChatText)
        console.log('----------------------------------------')

        while (true) {
          index = Math.min(index + 3, myChatTextLenth)
          myChat.text = myChatText.slice(0, index)
          res.write(`\n${JSON.stringify(myChat)}`)
          await new Promise(resolve => setTimeout(resolve, 50))
          if (index === myChatTextLenth)
            break
        }

        res.write(`${JSON.stringify(myChat)}`)
        dbRecord.conversation = myChat.text
        dbRecord.conversationId = myChat.conversationId
        dbRecord.finish_reason = 'stop'
      }
    }
  }
  catch (error) {
    res.write(JSON.stringify({ message: `[请求异常，请联系管理员！微信：18514665919]${error.message}` }))
  }
}
