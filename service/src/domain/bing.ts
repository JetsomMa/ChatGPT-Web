import ProxyAgent from 'proxy-agent'
import { sqlDB } from '../utils'
import type { IBingInfoPartial } from '../bing/server'
import { NewBingServer } from '../bing/server'
import { NewBingSocket, sendConversationMessage } from '../bing/socket'

function processString(str) {
  const regex = /\[\^(\d+)\^\]/g
  const matches = str.match(regex)
  const result = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const num = match.match(/\d+/)[0]
    result.push(num)
  }

  return result
}

function replaceText(str) {
  // 匹配类似 [^1^] 和 [^2^]: xxx 的内容，并将其替换为空字符串
  str = str.replace(/\[\^\d+\^\](?::\s*\[[^\]]*\])?/g, '')
  return str
}

export async function replyBing(prompt, dbRecord, res) {
  try {
    const myChat: any = await queryBing(prompt, res)

    const resouces = processString(myChat.text)
    myChat.text = replaceText(myChat.text)

    if (myChat) {
      myChat.role = 'assistant'

      let cankaostring = ''
      if (myChat.sourceAttributions) {
        for (let i = 0; i < myChat.sourceAttributions.length; i++) {
          if (resouces.includes(String(i + 1))) {
            const source = myChat.sourceAttributions[i]
            cankaostring += `[${source.providerDisplayName}](${source.seeMoreUrl})\n`
          }
        }
      }

      // const regex = /\:[[^\]]+\]\([^)]+\)/g
      // myChat.text = myChat.text.replace(/\[\^\d\^\]/g, '').replace(regex, '')
      if (cankaostring)
        myChat.text = `${myChat.text}\n\n` + `参考资料：\n${cankaostring}`

      // res.write(`\n${JSON.stringify(myChat)}`)

      const myChatText = myChat.text
      let index = 0
      const myChatTextLenth = myChatText.length

      console.log('myChatText -> ', myChatText)

      while (true) {
        index = Math.min(index + 6, myChatTextLenth)
        myChat.text = myChatText.slice(0, index)
        res.write(`\n${JSON.stringify(myChat)}`)
        await new Promise(resolve => setTimeout(resolve, 50))
        if (index === myChatTextLenth)
          break
      }

      dbRecord.conversation = myChat.text
      dbRecord.conversationId = myChat.conversationId
      dbRecord.finish_reason = 'stop'
    }
    else {
      res.write(`\n${JSON.stringify({ text: '请不要重复查询！' })}`)
    }
  }
  catch (error) {
    res.write(JSON.stringify({ message: `[请求异常，请联系管理员！微信：18514665919]${error.message}` }))
  }
}

async function queryBing(prompt, res) {
  try {
    const bingCookieList = await sqlDB.select('keyvalue', { where: { key: 'bing_cookie' } })

    if (bingCookieList.length === 0) {
      // res.write(JSON.stringify({ message: '浏览器cookie缺失，请联系管理员！微信：18514665919' }))
      return Promise.reject(new Error('浏览器cookie缺失，请联系管理员！微信：18514665919'))
    }
    else {
      res.write(`\n${JSON.stringify({ text: '初始化中，请稍后...' })}`)
      const bingCookie = bingCookieList[0].value

      const config = {
        cookie: bingCookie,
        bingUrl: 'https://www.bing.com',
        proxyUrl: process.env.HTTPS_PROXY,
        bingSocketUrl: 'wss://sydney.bing.com',
      }

      const agent = config.proxyUrl ? ProxyAgent(config.proxyUrl) : undefined // 访问vpn代理地址

      // bing的conversation信息，BingServer请求的结果
      const bingServer = new NewBingServer({
        agent,
      }, config)
      // 初始化bing的websocket消息
      const options: any = {}
      if (agent)
        options.agent = agent
      const bingSocket = new NewBingSocket({
        address: '/sydney/ChatHub',
        options,
      }, config)

      await bingServer.initConversation()// 重置请求
      const bingInfo: IBingInfoPartial = bingServer.bingInfo

      let myChat: any
      // const regex = /\:[[^\]]+\]\([^)]+\)/g
      return new Promise((resolve) => {
        bingSocket.mixBingInfo(bingInfo).createWs().initEvent()
          .on('init:finish', () => { // socket初始化完成
            console.log('bingSocket: 初始化完成')
            res.write(`\n${JSON.stringify({ text: `开始浏览器查询：${prompt}` })}`)
            sendConversationMessage.call(bingSocket, { message: prompt })
          }).on('message:ing', (data) => {
            myChat = data
            // if (myChat) {
            //   myChat.role = 'assistant'
            //   myChat.text = myChat.text.replace(/\[\^\d\^\]/g, '').replace(regex, '')
            //   res.write(`\n${JSON.stringify(myChat)}`)
            // }

            // console.log('bingSocket: 对话执行中')
          }).on('message:finish', (data) => {
            console.log('bingSocket: 对话执行完成', data)
            resolve(myChat)
          })
      })
    }
  }
  catch (error) {
    Promise.reject(error)
  }
}
