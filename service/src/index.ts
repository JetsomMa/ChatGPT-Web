import express from 'express'
import CryptoJS from 'crypto-js'
import axios from 'axios'
import type { ChatMessage } from './chatgpt'
import type { RequestProps, VerifyProps } from './types'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'
import { executeCommand, replyCommand, resultCommandMessage } from './domain/command'
import { replyBing } from './domain/bing'
import { replyChatGPT } from './domain/chatgpt'
import { replyWolframalpha } from './domain/wolframalpha'
import { replyMidjourney } from './domain/midjourney'
import { dateFormat, getNthDayAfterToday, sqlDB } from './utils'

// const MidjourneyQueue = []
const port = process.env.PORT || 3002
const app = express()
const router = express.Router()

const AESKey = CryptoJS.MD5(process.env.AUTH_SECRET_KEY || '1234567890123456').toString()
// 定义AES解密函数
function decryptData(data) {
  const decrypted = CryptoJS.AES.decrypt(data, AESKey, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  })
  return decrypted.toString(CryptoJS.enc.Utf8)
}

// 定义中间件函数
function myMiddleware(req, res, next) {
  if (req.url.includes('/chat-query')) {
    next() // 调用next()函数将控制权交给下一个中间件或路由处理函数
  }
  else {
    // 如果加密数据或密钥为空，则返回错误响应
    if (!req.headers.referer.includes('mashaojie.cn') && !req.headers.referer.includes('localhost') && !req.headers.referer.includes('192.168.') && !req.headers.referer.includes('118.195.236.91'))
      return res.status(401).send('Unauthorized')

    if (req.url.includes('/chat-process'))
      req.body = JSON.parse(decryptData(req.body.queryData))

    next() // 调用next()函数将控制权交给下一个中间件或路由处理函数
  }
}

app.use(express.static('public'))
app.use(express.json())

// 注册中间件函数
app.use(myMiddleware)

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

async function chatProcess(prompt, querymethod, dbRecord, res, options, systemMessage, temperature) {
  prompt = prompt.trim()

  if (prompt) {
    if (prompt.startsWith('/查询 ') || prompt.startsWith('/操作 '))
      await replyCommand(prompt, dbRecord, res)

    else if (querymethod === '浏览器')
      await replyBing(prompt, dbRecord, res)

    else if (querymethod === '画画')
      await replyMidjourney(prompt, dbRecord, res)

    else if (querymethod === '运算')
      await replyWolframalpha(prompt, dbRecord, res, options)

    else await replyChatGPT(prompt, dbRecord, res, options, systemMessage, temperature)
  }
  else {
    console.error('请输入您的会话内容')
    res.write(JSON.stringify({ message: '请输入您的会话内容' }))
  }
}

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')
  console.error('req.body -> ', req.body)

  const { prompt, querymethod, options = {}, systemMessage, temperature, device, username, telephone } = req.body as RequestProps
  const dbRecord: any = { prompt, querymethod, device, username, modeltype: 'gpt-3.5', telephone }
  try {
    // 保存会话记录
    try {
      if (sqlDB) {
        const dbresult = await sqlDB.insert('chatweb', dbRecord)
        dbRecord.id = dbresult.insertId
      }
    }
    catch (error) {
      console.error(error)
    }

    const userList = await sqlDB.select('userinfo', { where: { telephone } })
    if (userList.length || !process.env.AUTH_SECRET_KEY) {
      const userinfo = userList[0]
      const nowDate = dateFormat(new Date(), 'yyyyMMdd')
      if (process.env.AUTH_SECRET_KEY && userinfo.status === '3') {
        console.error('用户已被禁用，请联系管理员，微信：18514665919')
        dbRecord.conversation = '用户已被禁用，请联系管理员，微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)'
        dbRecord.finish_reason = 'stop'
        res.write(JSON.stringify({ message: dbRecord.conversation }))
      }
      else if (process.env.AUTH_SECRET_KEY && userinfo.expired <= nowDate) {
        // 如果用户已过期
        if (querymethod === '画画') {
          if (userinfo.dalleday <= 0 || userinfo.dallemonth <= 0) {
            dbRecord.conversation = '画画功能超过每日1张免费限额，请联系管理员进行充值(包月20元，包含5张画画额度)！微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)'
            res.write(JSON.stringify({ message: dbRecord.conversation }))
          }
          else {
            // if (MidjourneyQueue.length >= 1) {
            //   res.write(JSON.stringify({ message: '画画队列已满，请稍后重试！' }))
            // }
            // else {
            //   MidjourneyQueue.push({ prompt, dbRecord, res })

            try {
              userinfo.dalleday--
              userinfo.dallemonth--
              await chatProcess(prompt, querymethod, dbRecord, res, options, systemMessage, temperature)
              sqlDB.update('userinfo', userinfo)
            }
            catch (error) {
              throw new Error(error)
            }
            // finally {
            //   MidjourneyQueue.shift()
            // }
            // }
          }
        }
        else if (querymethod === 'ChatGPT') {
          if (userinfo.chatgptday <= 0) {
            dbRecord.conversation = 'ChatGPT功能超过每日3次免费限额，请联系管理员进行充值(包月20元，包含5张画画额度)！微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)'
            res.write(JSON.stringify({ message: dbRecord.conversation }))
          }
          else {
            userinfo.chatgptday--
            sqlDB.update('userinfo', userinfo)
            await chatProcess(prompt, querymethod, dbRecord, res, options, systemMessage, temperature)
          }
        }
        else {
          await chatProcess(prompt, querymethod, dbRecord, res, options, systemMessage, temperature)
        }
      }
      else {
        // 如果用户未过期
        if (querymethod === '画画') {
          if (userinfo.dallemonth <= 0 && userinfo.extenddalle <= 0) {
            dbRecord.conversation = '画画功能超过每月5张限额，请联系管理员进行充值(20张/10元)！微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)'
            res.write(JSON.stringify({ message: dbRecord.conversation }))
          }
          else {
            // if (MidjourneyQueue.length >= 1) {
            //   res.write(JSON.stringify({ message: '画画队列已满，请稍后重试！' }))
            // }
            // else {
            //   MidjourneyQueue.push({ prompt, dbRecord, res })

            try {
              if (userinfo.dallemonth > 0) {
                userinfo.dallemonth--
                await chatProcess(prompt, querymethod, dbRecord, res, options, systemMessage, temperature)
                sqlDB.update('userinfo', userinfo)
              }
              else if (userinfo.extenddalle > 0) {
                userinfo.extenddalle--
                await chatProcess(prompt, querymethod, dbRecord, res, options, systemMessage, temperature)
                sqlDB.update('userinfo', userinfo)
              }
            }
            catch (error) {
              throw new Error(error)
            }
            // finally {
            //   MidjourneyQueue.shift()
            // }
            // }
          }
        }
        else {
          await chatProcess(prompt, querymethod, dbRecord, res, options, systemMessage, temperature)
        }
      }
    }
    else {
      console.error('用户不存在，请联系管理员，微信：18514665919！')
      res.write(JSON.stringify({ message: '用户不存在，请联系管理员，微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)' }))
    }
  }
  catch (error) {
    res.write(`${JSON.stringify(error)}\n请联系管理员，微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)`)
  }
  finally {
    try {
      if (sqlDB && dbRecord.id)
        sqlDB.update('chatweb', dbRecord)

      // 推送消息到微信
      try {
        const response = await axios.post('http://118.195.236.91:3010/api/wxPusher', dbRecord)

        if (response.status !== 200)
          console.error('response --> ', response)
      }
      catch (error) {
        console.error('error.message --> ', error.message)
      }
    }
    catch (error) {
      console.error(error.message)
    }

    res.end()
  }
})

router.post('/chat-query', async (req, res) => {
  // const systemMessage = `当前时间为: ${dateFormat(new Date(new Date().getTime() + 8 * 60 * 60 * 1000), 'yyyy年MM月dd日 hh时mm分ss秒')}\n\n您是一个知识渊博的学者，基于openai公司的chatgpt3.5版本，有着极其严谨而又风趣的聊天态度，请尽可能准确详细的回答问题。`
  const systemMessage = `当前时间为: ${dateFormat(new Date(), 'yyyy年MM月dd日 hh时mm分ss秒')}\n\n您是一个知识渊博的学者，基于openai公司的chatgpt3.5版本，有着极其严谨而又风趣的聊天态度，请尽可能准确详细的回答问题。`
  const device = 'wechat'
  let { prompt, username, telephone } = req.body as RequestProps

  const dbRecord: any = { prompt, device, username, modeltype: 'gpt-3.5', telephone }
  try {
    prompt = prompt.trim()

    if (prompt) {
      try {
        if (sqlDB) {
          const dbresult = await sqlDB.insert('chatweb', dbRecord)
          dbRecord.id = dbresult.insertId
        }
      }
      catch (error) {
        console.error(error)
      }

      let mySystemMessage = ''

      if (telephone === '18514665919' && (prompt.startsWith('/查询 ') || prompt.startsWith('/操作 '))) {
        const result = await executeCommand(prompt, dbRecord)
        if (result.startsWith('error:')) {
          dbRecord.conversation = result
          dbRecord.finish_reason = 'stop'
        }
        else {
          prompt = result
          mySystemMessage = resultCommandMessage
        }
      }
      else {
        mySystemMessage = systemMessage
      }

      let myChat: ChatMessage | undefined
      await chatReplyProcess({
        message: prompt,
        process: (chat: ChatMessage) => {
          myChat = chat
        },
        systemMessage: mySystemMessage,
        temperature: 0,
      })

      if (myChat) {
        dbRecord.conversation = myChat.text
        dbRecord.conversationId = myChat.id
        dbRecord.finish_reason = myChat.detail.choices[0].finish_reason
      }
    }
    else {
      dbRecord.conversation = '请输入您的会话内容'
      dbRecord.finish_reason = 'stop'
    }
  }
  catch (error) {
    res.status(500).send(JSON.stringify(error))
  }
  finally {
    try {
      if (sqlDB && dbRecord.id)
        sqlDB.update('chatweb', dbRecord)

      try {
        const response = await axios.post('http://118.195.236.91:3010/api/wxPusher', dbRecord)

        if (response.status !== 200)
          console.error('response --> ', response)
      }
      catch (error) {
        console.error('error.message --> ', error.message)
      }

      res.send(dbRecord.conversation)
    }
    catch (error) {
      console.error(error.message)
    }
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY

    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token, username, telephone, remark, phonecode } = req.body as VerifyProps

    // 验证码校验
    const nowDate = dateFormat(new Date(), 'yyyyMMdd')
    const nowTime = new Date().getTime()
    const rows = await sqlDB.query(`SELECT * FROM phonecode where expired > '${nowTime}' and telephone = '${telephone}' and phonecode = ${phonecode} and status = 0`)
    if (rows && rows.length === 0)
      throw new Error('验证码错误！')

    if (!token)
      throw new Error('Secret key is empty')

    const userList = await sqlDB.select('userinfo', { where: { telephone } })

    if (userList.length === 0) {
      let expired = dateFormat(getNthDayAfterToday(15), 'yyyyMMdd')
      if (expired < '20230531')
        expired = '20230531'

      await sqlDB.insert('userinfo', { username, telephone, status: 2, remark, expired, chatgptday: 5, dallemonth: 5, dalleday: 1, extenddalle: 0 })
      // 消息推送，用于用户激活
      try {
        const response = await axios.post('http://118.195.236.91:3010/api/wxPusherNewUser', { username, telephone, remark })

        if (response.status !== 200)
          console.error('response --> ', response)
      }
      catch (error) {
        console.error('error.message --> ', error.message)
      }
    }
    else if (userList[0].status === '3') { throw new Error('用户已被禁用，请联系管理员，微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)') }
    else if (userList[0].expired < nowDate) { throw new Error('账户已过期，请联系管理员进行充值服务，微信：18514665919\n![](https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)') }

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    await sqlDB.update('phonecode', { status: 1 }, { where: { telephone, phonecode, status: 0 } })
    userList[0].username = username
    await sqlDB.update('userinfo', userList[0], { where: { telephone } })
    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

interface PhoneCode {
  telephone: string
}
// 生成验证码
router.post('/phonecode', async (req, res) => {
  try {
    const { telephone } = req.body as PhoneCode

    // const nowTime = new Date().getTime()
    // const rows = await sqlDB.query(`SELECT * FROM phonecode where expired > '${nowTime}' and telephone = '${telephone}' and status = 0`)
    // if (rows && rows.length > 0) {
    //   throw new Error('验证码已发送，请勿重复发送！')
    // }
    // else {
    const min = 100000
    const max = 999999
    const phonecode = Math.floor(Math.random() * (max - min + 1)) + min
    await sqlDB.insert('phonecode', { telephone, phonecode, status: 0 })

    try {
      const response = await axios.post('http://118.195.236.91:3010/api/sendMessage', { phone: telephone, codeText: `${phonecode}` })

      if (response.status !== 200)
        console.error('response --> ', response)
      else
        res.send({ status: 'Success', message: 'phonecode successfully', data: null })
    }
    catch (error) {
      console.error('error.message --> ', error.message)
    }
    // }
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(port, () => globalThis.console.log(`Server is running on port ${port}`))
