import express from 'express'
import { RDSClient } from 'ali-rds'
import CryptoJS from 'crypto-js'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'

function dateFormat(dataStamp) {
  const date = new Date(dataStamp)
  const year = date.getFullYear()

  const month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1
  const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()
  const hours = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours()
  const minutes = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes()
  const seconds = date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()
  // 拼接
  return `${year}${month}${day} ${hours}:${minutes}:${seconds}`
}

let sqlDB: RDSClient | undefined
if (process.env.DATASET_MYSQL_USER) {
  sqlDB = new RDSClient({
    host: '118.195.236.91',
    port: 3306,
    user: process.env.DATASET_MYSQL_USER,
    password: process.env.DATASET_MYSQL_PASSWORD,
    database: process.env.DATASET_MYSQL_DATABASE,
  })
}

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
  // 如果加密数据或密钥为空，则返回错误响应
  if (!req.headers.referer.includes('chat.mashaojie.cn') && !req.headers.referer.includes('localhost'))
    return res.status(401).send('Unauthorized')

  if (req.url.includes('/chat-process'))
    req.body = JSON.parse(decryptData(req.body.queryData))

  next() // 调用next()函数将控制权交给下一个中间件或路由处理函数
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

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  let myChat: ChatMessage | undefined
  const { prompt, options = {}, systemMessage, temperature } = req.body as RequestProps

  try {
    let firstChunk = true
    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false

        myChat = chat
      },
      systemMessage,
      temperature,
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    try {
      if (sqlDB)
        sqlDB.insert('chatweb', { prompt, conversation: myChat.text, conversationId: myChat.id, finish_reason: myChat.detail.choices[0].finish_reason, datetime: dateFormat(new Date().getTime()) })
    }
    catch (error) {
      console.error(error)
    }
    myChat = undefined
    res.end()
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
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
