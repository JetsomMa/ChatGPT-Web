import ProxyAgent from 'proxy-agent'
import { sqlDB } from '../utils'
import { NewBingServer } from '../bing/server'
import { NewBingSocket, sendConversationMessage } from '../bing/socket'

// function processString(str) {
//   const regex = /\[\^(\d+)\^\]/g
//   const matches = str.match(regex)
//   const result = []

//   if (matches) {
//     for (let i = 0; i < matches.length; i++) {
//       const match = matches[i]
//       const num = match.match(/\d+/)[0]
//       result.push(num)
//     }
//   }

//   return result
// }

function replaceText(str) {
  // 匹配类似 [^1^] 和 [^2^]: xxx 的内容，并将其替换为空字符串
  str = str.replace(/\[\^\d+\^\](?::\s*\[[^\]]*\])?/g, '')
  str = str.replace(/\(https?:\/\/[^\s)]+\)/g, '')
  return str
}

export async function replyBing(prompt, dbRecord, res) {
  try {
    const myChat: any = await queryBing(prompt, res)

    // const resouces = processString(myChat.text)
    myChat.text = replaceText(myChat.text)

    if (myChat) {
      myChat.role = 'assistant'

      let cankaostring = ''
      if (myChat.sourceAttributions) {
        for (let i = 0; i < myChat.sourceAttributions.length; i++) {
          // if (resouces.includes(String(i + 1))) {
          const source = myChat.sourceAttributions[i]
          cankaostring += `[${source.providerDisplayName}](${source.seeMoreUrl})\n`
          // }
        }
      }

      if (cankaostring)
        myChat.text = `${myChat.text}\n\n` + `相关资料：\n${cankaostring}`

      myChat.finish = true
      res.write(`\n${JSON.stringify(myChat)}`)

      // const myChatText = myChat.text
      // let index = 0
      // const myChatTextLenth = myChatText.length

      // console.warn('myChatText -> ', myChatText)

      // myChat.text = myChatText

      // while (true) {
      //   index = Math.min(index + 6, myChatTextLenth)
      //   myChat.text = myChatText.slice(0, index)
      //   res.write(`\n${JSON.stringify(myChat)}`)
      //   await new Promise(resolve => setTimeout(resolve, 50))
      //   if (index === myChatTextLenth)
      //     break
      // }

      dbRecord.conversation = myChat.text
      dbRecord.conversationId = myChat.conversationId
      dbRecord.finish_reason = 'stop'
    }
    else {
      res.write(`\n${JSON.stringify({ text: '查询异常了！\n请联系管理员，微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)' })}`)
    }
  }
  catch (error) {
    res.write(`\n${JSON.stringify({ text: `[请求异常，请联系管理员！微信：18514665919]${error.message}\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)` })}`)
  }
}

async function queryBing(prompt, res) {
  try {
    res.write(`\n${JSON.stringify({ text: '初始化中，请稍后...' })}`)
    const bingSocket = await initBingServer()

    if (bingSocket) {
      let myChat: any
      return new Promise((resolve) => {
        bingSocket.on('init:finish', () => { // socket初始化完成
          console.warn('bingSocket: 初始化完成')
          res.write(`\n${JSON.stringify({ text: `开始浏览器查询：${prompt}` })}`)
          sendConversationMessage.call(bingSocket, { message: prompt })
        }).on('message:ing', (data) => {
          if (data && data.text && data.text.length > 0) {
            myChat = data
            res.write(`\n${JSON.stringify(myChat)}`)
          }
          console.warn('bingSocket: 对话执行中')
        }).on('message:finish', (data) => {
          console.warn('bingSocket: 对话执行完成')
          if (!myChat)
            myChat = data

          bingSocket.clearWs()
          resolve(myChat)
        })
      })
    }
    else {
      Promise.reject(new Error('浏览器初始化失败！'))
    }
  }
  catch (error) {
    Promise.reject(error)
  }
}

export async function initBingServer() {
  const bingCookieList = await sqlDB.select('keyvalue', { where: { key: 'bing_cookie' } })

  if (bingCookieList.length === 0) {
    throw new Error('浏览器cookie缺失，请联系管理员！微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)')
  }
  else {
    const bingCookie = bingCookieList[0].value

    const config = {
      cookie: bingCookie,
      bingUrl: 'https://www.bing.com',
      proxyUrl: process.env.HTTPS_PROXY,
      bingSocketUrl: 'wss://sydney.bing.com',
    }

    const agent = config.proxyUrl ? ProxyAgent(config.proxyUrl) : undefined // 访问vpn代理地址

    // bing的conversation信息，BingServer请求的结果
    let bingServer = new NewBingServer({
      agent,
    }, config)
    // 初始化bing的websocket消息
    const options: any = {}
    if (agent)
      options.agent = agent

    let bingSocket = new NewBingSocket({
      address: '/sydney/ChatHub',
      options,
    }, config)

    await bingServer.initConversation()// 重置请求
    if (bingServer.bingInfo) {
      bingSocket.mixBingInfo(bingServer.bingInfo).createWs().initEvent()

      bingSocket.on('close', () => {
        console.warn('bingSocket: close')
        bingServer = undefined
        bingSocket = undefined
      })

      return bingSocket
    }
    else {
      return null
    }
  }
}
