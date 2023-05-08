import express from 'express'
import { RDSClient } from 'ali-rds'
import CryptoJS from 'crypto-js'
import axios from 'axios'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'

const port = process.env.PORT || 3002
let sqlDB: RDSClient | undefined
if (process.env.DATASET_MYSQL_USER) {
  sqlDB = new RDSClient({
    host: '118.195.236.91',
    port: 3306,
    user: process.env.DATASET_MYSQL_USER,
    password: process.env.DATASET_MYSQL_PASSWORD,
    database: process.env.DATASET_MYSQL_DATABASE,
    charset: 'utf8mb4',
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

function dateFormat(date, fmt) { // author: meizz
  fmt = fmt || 'yyyy-MM-dd hh:mm:ss'
  const o = {
    'M+': date.getMonth() + 1, // 月份
    'd+': date.getDate(), // 日
    'h+': date.getHours(), // 小时
    'm+': date.getMinutes(), // 分
    's+': date.getSeconds(), // 秒
    'q+': Math.floor((date.getMonth() + 3) / 3), // 季度
    'S': date.getMilliseconds(), // 毫秒
  }
  if (/(y+)/.test(fmt))
    fmt = fmt.replace(RegExp.$1, (`${date.getFullYear()}`).substr(4 - RegExp.$1.length))
  for (const k in o) {
    if (new RegExp(`(${k})`).test(fmt))
      fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : ((`00${o[k]}`).substr((`${o[k]}`).length)))
  }
  return fmt
}

function getNthDayAfterToday(n) {
  const today = new Date() // 获取当前时间
  const nthDayAfter = new Date(today.getTime() + 24 * 60 * 60 * 1000 * n) // 计算 n 天后的时间
  return nthDayAfter
}

const tableInfo = `用户信息表：userinfo
id: 用户id
username: 用户名
telephone: 手机号
status: 状态 [0-未激活，2-已激活，3-已禁用]
expired: 过期时间
remark: 备注

对话信息表：chatweb
id: 对话id
username: 用户名
telephone: 手机号
prompt: 提问
conversation: 回答
createtime: 提问时间`

const systemMessage = `您将扮演一个数据库管理员的角色，请保持严谨，不要伪造信息。现在有以下两个数据库表，请根据用户提问生成mysql数据库的sql语句，输出格式为json，不要有额外的解释和说明：
  ${tableInfo}

  问答的示例：[Q: 问题  A: 回答]
      Q: "/查询 前10名用户的信息"
      A: { "operate": "query", sql:"SELECT id,username,telephone,status,expired,remark FROM userinfo LIMIT 10", "level": "S" }
      Q: "/查询 所有用户的名字和手机号信息"
      A: { "operate": "query", sql:"SELECT id,username,telephone FROM userinfo", "level": "S" }
      Q: "/查询 用户信息18514665919"
      A: { "operate": "query", sql:"SELECT id,username,telephone,status,expired,remark FROM userinfo where telephone = '18514665919'", "level": "S" }
      Q: "/查询 马少杰的电话、状态和过期时间"
      A: { "operate": "query", sql:"SELECT id,telephone,status,expired FROM userinfo where username = '马少杰'", "level": "S" }
      Q: "/查询 李振华的提问"
      A: { "operate": "query", sql:"SELECT id,prompt FROM chatweb where username = '李振华'", "level": "S" }
      Q: "/查询 我的过期时间"
      A: { "operate": "query", sql:"SELECT id,expired FROM userinfo where telephone=:telephone", "level": "A" }
      Q: "/查询 我的信息"
      A: { "operate": "query", sql:"SELECT id,username,telephone,status,expired,remark FROM userinfo where telephone=:telephone", "level": "A" }
      Q: "/查询 我的提问"
      A: { "operate": "query", sql:"SELECT id,prompt FROM chatweb where telephone=:telephone", "level": "A" }
      Q: "/查询 3456的会话"
      A: { "operate": "query", sql:"SELECT id,prompt,conversation,createtime FROM chatweb where id=3456", "level": "A" }

      Q: "/操作 激活12399998888"
      A: { "operate": "update", "table": "userinfo", "row": { "status": "2" }, "where": { "telephone": "12399998888" }, "level": "S" }
      Q: "/操作 禁用李振华"
      A: { "operate": "update", "table": "userinfo", "row": { "status": "3" }, "where": { "username": "李振华" }, "level": "S" }
      Q: "/操作 禁用13677776666"
      A: { "operate": "update", "table": "userinfo", "row": { "status": "3" }, "where": { "telephone": "13677776666" }, "level": "S" }
      Q: "/操作 充值18514665919"
      A: { "operate": "queryupdate", "sql": "UPDATE userinfo SET expired = DATE_FORMAT(LAST_DAY(DATE_ADD(STR_TO_DATE(expired, '%Y%m%d'), INTERVAL 1 MONTH)), '%Y%m%d') where telephone = '18514665919', "table": "userinfo", "where": { "telephone": "18514665919" }, "level": "S" }
  `

const resultSystemMessage = `您将扮演一个翻译员的角色，帮我格式化这个输出结果，如果包含json则整理成表格，请保持严谨，不要伪造信息，不要有额外的解释和说明。
  ${tableInfo}

  问答的示例：[Q: 问题  A: 回答]
    Q: "[{"expired":"99999999"}]"
    A: "| expired |\n|-----------|\n| 2023-06-30|"
`
async function executeCommand(prompt, record) {
  try {
    let myChat: ChatMessage | undefined

    await chatReplyProcess({
      message: prompt,
      process: (chat: ChatMessage) => {
        myChat = chat
      },
      systemMessage,
      temperature: 0,
    })

    const command = JSON.parse(myChat.text)

    console.log('command --> ', command)

    if (command.level === 'S' && record.telephone !== '18514665919') {
      return 'error: 您没有权限执行此命令'
    }
    else {
      if (command.operate === 'update' || command.operate === 'queryupdate') {
        let userList = await sqlDB.select(command.table, { where: command.where })
        if (userList.length === 0)
          return 'error: 用户不存在'
        else if (userList.length > 1)
          return 'error: 用户存在多个'

        if (command.operate === 'queryupdate')
          await sqlDB.query(command.sql, record)

        else
          await sqlDB.update(command.table, command.row, { where: command.where })

        userList = await sqlDB.select(command.table, { where: command.where })
        return `操作成功！${JSON.stringify(userList[0])}`
      }
      if (command.operate === 'query') {
        const result = await sqlDB.query(command.sql, record)
        return JSON.stringify(result)
      }
      else {
        if (command.where && command.where.telephone === '$telephone')
          command.where.telephone = record.telephone

        const query: any = {}
        command.where && (query.where = command.where)
        command.columns && (query.columns = command.columns)
        const result = await sqlDB.select(command.table, query)

        return JSON.stringify(result)
      }
    }
  }
  catch (error) {
    return `error: 指令执行失败：${error.message}`
  }
}

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  let myChat: ChatMessage | undefined
  let { prompt, options = {}, systemMessage, temperature, device, username, telephone } = req.body as RequestProps

  const dbRecord: any = { prompt, device, username, modeltype: 'gpt-3.5', telephone }
  try {
    const userList = await sqlDB.select('userinfo', { where: { username, telephone } })
    if (userList.length || !process.env.AUTH_SECRET_KEY) {
      const nowDate = dateFormat(new Date(), 'yyyyMMdd')
      if (process.env.AUTH_SECRET_KEY && userList[0].status === '3') {
        console.error('用户已被禁用，请联系管理员！')
        res.write(JSON.stringify({ message: '用户已被禁用，请联系管理员！' }))
      }
      else if (process.env.AUTH_SECRET_KEY && userList[0].expired <= nowDate) {
        res.write(JSON.stringify({ message: '账户已过期，请联系管理员进行充值服务！微信：18514665919' }))
      }
      else {
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

          if (prompt.startsWith('/') || prompt.startsWith('？')) {
            const result = await executeCommand(prompt, dbRecord)
            if (result.startsWith('error:')) {
              res.write(JSON.stringify({ message: result }))
            }
            else {
              let firstChunk = true
              await chatReplyProcess({
                message: result,
                process: (chat: ChatMessage) => {
                  res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
                  firstChunk = false

                  myChat = chat
                },
                systemMessage: resultSystemMessage,
                temperature: 0,
              })
            }
          }
          else {
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
        }
        else {
          console.error('请输入您的会话内容')
          res.write(JSON.stringify({ message: '请输入您的会话内容' }))
        }
      }
    }
    else {
      console.error('用户不存在，请联系管理员！')
      res.write(JSON.stringify({ message: '用户不存在，请联系管理员！' }))
    }
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    try {
      if (sqlDB && dbRecord.id) {
        dbRecord.conversation = myChat.text
        dbRecord.conversationId = myChat.id
        dbRecord.finish_reason = myChat.detail.choices[0].finish_reason
        sqlDB.update('chatweb', dbRecord)
      }

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
    myChat = undefined
    res.end()
  }
})

router.post('/chat-query', async (req, res) => {
  const temperature = 0.5
  const systemMessage = '您是一个知识渊博的学者，基于openai公司的chatgpt3.5版本，有着极其严谨而又风趣的聊天态度，请尽可能准确详细的回答问题。'
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

      if (telephone === '18514665919' && (prompt.startsWith('/') || prompt.startsWith('？'))) {
        const result = await executeCommand(prompt, dbRecord)
        dbRecord.conversation = result
        dbRecord.finish_reason = 'stop'
      }
      else {
        const result = await chatReplyProcess({
          message: prompt,
          systemMessage,
          temperature,
        })

     		dbRecord.conversation = result.data.text
        dbRecord.conversationId = result.data.id
        dbRecord.finish_reason = result.data.detail.choices[0].finish_reason
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

interface VerifyProps {
  token: string
  username: string
  telephone: string
  remark: string
  phonecode: string
}
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

    const userList = await sqlDB.select('userinfo', { where: { username, telephone } })

    if (userList.length === 0) {
      let expired = dateFormat(getNthDayAfterToday(3), 'yyyyMMdd')
      if (expired < '20230531')
        expired = '20230531'

      await sqlDB.insert('userinfo', { username, telephone, status: 2, remark, expired })
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
    else if (userList[0].status === '3') { throw new Error('用户已被禁用，请联系管理员！') }
    else if (userList[0].expired < nowDate) { throw new Error('账户已过期，请联系管理员进行充值服务！微信：18514665919') }

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    await sqlDB.update('phonecode', { status: 1 }, { where: { telephone, phonecode, status: 0 } })
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

    const nowTime = new Date().getTime()
    const rows = await sqlDB.query(`SELECT * FROM phonecode where expired > '${nowTime}' and telephone = '${telephone}' and status = 0`)
    if (rows && rows.length > 0) {
      throw new Error('验证码已发送，请勿重复发送！')
    }
    else {
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
    }
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(port, () => globalThis.console.log(`Server is running on port ${port}`))
