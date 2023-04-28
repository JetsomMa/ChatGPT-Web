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
  // 如果加密数据或密钥为空，则返回错误响应
  if (!req.headers.referer.includes('mashaojie.cn') && !req.headers.referer.includes('localhost') && !req.headers.referer.includes('192.168.'))
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

const systemMessage = `您将扮演一个接口参数生成器的角色，请保持严谨，不要伪造信息，用户提出任何问题，返回json，且只返回一个json，不要包含任何额外的解释或说明。

  以下是您需要了解的内容：
      1、当输入中包含“用户”关键字时，table取值为userinfo；当输入中包含“提问”或“对话”关键字时，table取值为chatweb；
      2、手机号：telephone；姓名/名字：username；状态：status；过期时间：expired；提问/问题：prompt；回答/答案：conversation；提问时间/创建时间：createtime；
      3、在table为userinfo中，包含的字段有id、username、telephone、expired、status；
      4、status状态值：0-未激活，2-已激活，3-已禁用；
      5、在table为chatweb中，包含的字段有id、username、telephone、prompt、conversation、createtime；
      6、[查询]/【查询】的operate值为select，[操作]/【操作】的operate值为update；

  问答的示例：[Q: 问题  A: 回答]
      Q: "[查询]所有用户的信息"
      A: { "operate": "select", "table": "userinfo", "columns": ["id", "username", "telephone", "expired", "status"], "level": "S" }
      Q: "【查询】所有用户的名字和手机号信息"
      A: { "operate": "select", "table": "userinfo", "columns": ["username", "telephone"], "level": "S" }
      Q: "[查询]手机号为18514665919用户的信息"
      A: { "operate": "select", "table": "userinfo", "columns": ["id", "username", "telephone", "expired", "status"], "where": { "telephone": "18514665919" }, "level": "S" }
      Q: "【查询】手机号为12233445566用户的过期时间信息"
      A: { "operate": "select", "table": "userinfo", "columns": ["expired"], "where": { "telephone": "12233445566" }, "level": "S" }
      Q: "[查询]我的过期时间信息"
      A: { "operate": "select", "table": "userinfo", "columns": ["expired"], "where": { "telephone": "$telephone" }, "level": "A" }
      Q: "【查询】我的提问"
      A: { "operate": "select", "table": "chatweb", "columns": ["id", "prompt"], "where": { "telephone": "$telephone" }, "level": "A" }
      Q: "[查询]手机号为12233445566用户的提问"
      A: { "operate": "select", "table": "chatweb", "columns": ["id", "prompt"], "where": { "telephone": "12233445566" }, "level": "S" }
      Q: "[查询]第3489的对话内容"
      A: { "operate": "select", "table": "chatweb", "columns": ["id", "prompt", "conversation", "createtime"], "where": { "id": "3489" }, "level": "A" }
      Q: "[操作]激活用户12399998888"
      A: { "operate": "update", "table": "userinfo", "row": { "status": "2" }, "where": { "telephone": "12399998888" }, "level": "S" }
      Q: "【操作】激活用户12399998888"
      A: { "operate": "update", "table": "userinfo", "row": { "status": "2" }, "where": { "telephone": "12399998888" }, "level": "S" }
      Q: "【操作】禁用用户13677776666"
      A: { "operate": "update", "table": "userinfo", "row": { "status": "3" }, "where": { "telephone": "13677776666" }, "level": "S" }
  `

async function executeCommand(prompt, telephone) {
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
    if (command.level === 'S' && telephone !== '18514665919') {
      return 'error: 您没有权限执行此命令'
    }
    else {
      if (command.operate === 'update') {
        let userList = await sqlDB.select(command.table, { where: command.where })
        if (userList.length === 0)
          return 'error: 用户不存在'
        else if (userList.length > 1)
          return 'error: 用户存在多个'

        await sqlDB.update(command.table, command.row, { where: command.where })
        userList = await sqlDB.select(command.table, { where: command.where })
        return `操作成功！${JSON.stringify(userList[0])}`
      }
      else {
        if (command.where && command.where.telephone === '$telephone')
          command.where.telephone = telephone

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
    if (userList.length) {
      const nowDate = dateFormat(new Date(), 'yyyyMMdd')
      if (userList[0].status === '3') {
        console.error('用户已被禁用，请联系管理员！')
        res.write(JSON.stringify({ message: '用户已被禁用，请联系管理员！' }))
      }
      else if (userList[0].expired <= nowDate) {
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

          if (prompt.startsWith('[操作]') || prompt.startsWith('[查询]') || prompt.startsWith('【操作】') || prompt.startsWith('【查询】')) {
            const result = await executeCommand(prompt, telephone)
            if (result.startsWith('error:')) {
              res.write(JSON.stringify({ message: result }))
            }
            else {
              prompt = `帮我格式化这个输出结果，如果包含json则整理成表格，不要有其他多余的描述和解释：${result}`

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
}
router.post('/verify', async (req, res) => {
  try {
    const { token, username, telephone, remark } = req.body as VerifyProps

    const nowDate = dateFormat(new Date(), 'yyyyMMdd')

    if (!token)
      throw new Error('Secret key is empty')

    const userList = await sqlDB.select('userinfo', { where: { username, telephone } })

    if (userList.length === 0) {
      await sqlDB.insert('userinfo', { username, telephone, status: 0, remark })
      // 消息推送，用于用户激活
      try {
        const response = await axios.post('http://118.195.236.91:3010/api/wxPusherNewUser', { username, telephone, remark })

        if (response.status !== 200)
          console.error('response --> ', response)
      }
      catch (error) {
        console.error('error.message --> ', error.message)
      }
      throw new Error('注册成功，微信联系管理员进行激活！')
    }
    else if (userList[0].status === '3') { throw new Error('用户已被禁用 | User has been disabled') }
    else if (userList[0].status === '0') { throw new Error('已经进行过注册了，请微信联系管理员进行激活！') }
    else if (userList[0].expired <= nowDate) { throw new Error('账户已过期，请联系管理员进行充值服务！微信：18514665919') }

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

app.listen(port, () => globalThis.console.log(`Server is running on port ${port}`))
