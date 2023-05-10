import express from 'express'
import { RDSClient } from 'ali-rds'
import CryptoJS from 'crypto-js'
import axios from 'axios'
import httpsProxyAgent from 'https-proxy-agent'
import fetch from 'node-fetch'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'

const { HttpsProxyAgent } = httpsProxyAgent

async function getWebsitContent(url) {
  if (process.env.HTTPS_PROXY) {
    const httpsProxy = process.env.HTTPS_PROXY
    if (httpsProxy) {
      const agent = new HttpsProxyAgent(httpsProxy)
      const response = await fetch(url, { agent })
      return response
    }
  }
  else {
    const response = await fetch(url)
    return response
  }
}

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

const promptObject = {
  APIPrompt:
`Input: {query}
ChatGpt response: {resp}
Instructions:
Your task is to generate a list of API calls to a Question Answering API based on the input query and chatgpt response. The API calls should help extract relevant information and provide a better understanding of the input query and verify the response of chatgpt.
You can make an API call by using the following format: "{"API": "{API}", "query": "{query}"}". Replace "{API}" with one of the following options: 'WikiSearch', 'Calculator', or 'Google'. Replace "{query}" with the specific question you want to ask to extract relevant information.
Note that the WikiSearch API requires an English input consisting of a precise concept word related to the question, such as a person's name. The Google API requires a full, complete question in the same langeuage as the query that includes enough information about the question, such as who, what, when, where, and why. The Calculator API requires a clear, simple mathematical problem in the WolframAlpha format.
Here are some examples of API calls:
Input: Coca-Cola, or Coke, is a carbonated soft drink manufactured by the Coca-Cola Company.
Output: {"calls": [{"API": "Google", "query": "What other name is Coca-Cola known by?"},
{"API": "Google", "query": "Who manufactures Coca-Cola?"}]}
Input: Out of 1400 participants, 400 passed the test.
Output: {"calls":[{"API": "Calculator", "query": "400 / 1400"}]}
Input: 电视剧狂飙怎么样, 和三体比应该看哪一部?
Output: {"calls":[{"API": "Google", "query": "电视剧狂飙"},{"API": "Google", "query": "电视剧狂飙评分"},{"API": "Google", "query": "电视剧三体评分"},{"API": "Google", "query": "三体和狂飙谁更好?"}]}
To ensure better understanding, the Google API question must match the input query language. Additionally, the API calls should thoroughly validate every detail in ChatGPT's response.
Sort the JSON order based on relevance and importance as requested by the API query, with the most relevant item at the beginning of the list for easier understanding.`,
  ReplySumPrompt: `Query: {query}
API calls in JSON format generated by ChatGPT to extract related and helpful information for the query:
{apicalls}
Instructions:
Using the provided API call results in JSON format, provide a detailed and precise reply to the given query. If the query has any errors, use the API call results to correct them in your reply.
Here are some guidelines to help you write your reply:
- Use the information extracted from the API calls to provide a comprehensive and relevant reply to the query.
- If the API calls suggest that there is an error in the original query, point it out and provide a corrected version.
- Ensure that your reply is detailed and precise, providing all relevant information related to the query.
- Use clear and concise language to ensure that your reply is easily understandable.
- When answering, do not make up information, but base it on the results of the API.
Providing all relevant detailed information data relevant to the query, as comprehensive and detailed as possible, at least 300 words.
Your reply should be written in the same language as the query(if the query is asked in Chinese, reply in Chinese) and be easy to understand.`,
}

async function APIQuery(query, resp = '') {
  const prompt = promptObject.APIPrompt.replace('{query}', query).replace('{resp}', resp)
  const systemMessage = 'Your are a API caller for a LLM, you need to call some APIs to get the information you need.'

  let myChat: ChatMessage | undefined
  await chatReplyProcess({
    message: prompt,
    process: (chat: ChatMessage) => {
      myChat = chat
    },
    systemMessage,
    temperature: 0.5,
  })

  const pattern = /(\{[\s\S\n]*"calls"[\s\S\n]*\})/
  const match = myChat.text.match(pattern)
  // const APICallList = []
  if (match) {
    const json_data = match[1]
    const result = JSON.parse(json_data)
    // result.calls.push({ API: 'Google', query })
    // result.calls.push({ API: 'WikiSearch', query })
    // APICallList.push(result)
    return result
  }
  return JSON.parse('{"calls":[]}')
}

async function clean_string(inputStr) {
  // Replace multiple spaces with a single space
  let res = inputStr.replace(/\s+/g, ' ')
  // Remove spaces except between words
  res = res.replace(/(?<!\w)\s+|\s+(?!\w)/g, '')
  // Replace Chinese symbols with English equivalents
  const symbolDict = {
    '，': ' ',
    '。': ' ',
    '！': ' ',
    '？': ' ',
    '；': ' ',
    '：': ' ',
    '“': ' ',
    '”': ' ',
    '‘': ' ',
    '’': ' ',
    '（': ' ',
    '）': ' ',
    '《': ' ',
    '》': ' ',
    '【': ' ',
    '】': ' ',
    '｛': ' ',
    '｝': ' ',
    '〔': ' ',
    '〕': ' ',
    '〈': ' ',
    '〉': ' ',
    '「': ' ',
    '」': ' ',
    '『': ' ',
    '』': ' ',
    '﹃': ' ',
    '﹄': ' ',
    '﹁': ' ',
    '﹂': ' ',
    '、': ' ',
  }
  const pattern = new RegExp(Object.keys(symbolDict).map(key => `\\${key}`).join('|'), 'g')
  res = res.replace(pattern, match => symbolDict[match])
  // Remove consecutive periods
  // res = res.replace(/\.{2,}/g, '.');
  const pattern2 = /[,.;:!?]+$/
  res = res.replace(pattern2, '')
  res = res.replace(/<.+?>/g, '') // Remove HTML tags
  // res = res.replace(/\W{2,}/g, '')
  res = res.replace(/(\d) +(\d)/g, '$1,$2')
  res = res.trim() // Remove leading/trailing spaces

  const response = await axios.post('http://118.195.236.91:3011/api/removeStopwords', { text: res })

  return response.data
}

async function GoogleQuery(q, num, resp) {
  try {
    const queryUrl = `https://www.googleapis.com/customsearch/v1?key=AIzaSyCmwyTDGqTA400nRxNyfTR8E5ouywdbUQI&cx=56316500d81a644e4&q=${encodeURIComponent(q)}&num=${num}&c2coff=0`
    console.log('queryUrl --> ', queryUrl)

    let res: any = await getWebsitContent(queryUrl)
    if (res) {
      res = await res.json()
      res.items = res.items || []

      const retArray = []
      for (const item of res.items) {
        const text = await clean_string(`${item.title}: ${item.snippet}`)
        retArray.push(text)
      }

      return retArray.join('\n')
    }
    else {
      return ''
    }
  }
  catch (error) {
    console.error(`【error】 GoogleQuery ：${error.message}`)
    resp.write(JSON.stringify({ message: `【error】 GoogleQuery ：${error.message}` }))
  }
}

function remove_html_tags(text) {
  if (text) {
    const clean = /<.*?>/g
    return text.replace(clean, '')
  }
  else {
    return ''
  }
}

async function WikiQuery(q, num, resp) {
  try {
    const queryUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(q)}`
    console.log('queryUrl --> ', queryUrl)

    let res: any = await getWebsitContent(queryUrl)
    console.log(' wiki res --> ', data)
    if (res) {
      res = await res.json()

      const data = (res.query.search || []).slice(0, num)
      console.log(' wiki data --> ', data)
      const results = data.map(d => `${d.title}: ${remove_html_tags(d.snippet)}`)

      return results.join('\n')
    }
    else {
      return ''
    }
  }
  catch (error) {
    console.error(`【error】 WikiQuery ：${error.message}`)
    resp.write(JSON.stringify({ message: `【error】 WikiQuery ：${error.message}` }))
  }
}

async function search(content, max_query = 6, resp) {
  const call_list = content.calls
  let call_res = {}
  async function google_search(query, num_results = 4) {
    const search_data = await GoogleQuery(query, num_results, resp)
    call_res[`google/${query}`] = search_data
  }
  async function wiki_search(query, num_results = 3) {
    const search_data = await WikiQuery(query, num_results, resp)
    call_res[`wiki/${query}`] = search_data
  }

  for (const call of call_list.slice(0, max_query)) {
    const q = call.query
    const api = call.API
    if (api.toLowerCase() === 'google')
      await google_search(q, 4)
    else if (api.toLowerCase() === 'wikisearch')
      await wiki_search(q, 1)
    else
      continue
  }

  call_res = Object.fromEntries(Object.entries(call_res).filter(([key, value]) => String(value).length >= 10))
  const res = JSON.stringify(call_res)
  return res
}

async function chatGPTBrowser(prompt, res) {
  try {
    res.write(`\n${JSON.stringify({ text: '开始网络查询处理，处理过程较慢，请耐心等待...' })}`)
    const prompt1 = `current Time: ${dateFormat(new Date(new Date().getTime() + 8 * 60 * 60 * 1000), 'yyyy年MM月dd日 hh时mm分ss秒')}\n\n这个网站的提供者: 马少杰，他是一个为人友善、热爱技术、喜欢小动物的人，他的联系方式[手机号/微信]：18514665919\n\nQuery:${prompt}`

    let myChat: ChatMessage | undefined
    await chatReplyProcess({
      message: prompt1,
      process: (chat: ChatMessage) => {
        myChat = chat
      },
      temperature: 0.5,
    })

    res.write(`\n${JSON.stringify({ text: 'chatgpt查询完成...' })}`)

    console.log('+++++++++++++++++++++++++++++++++++++++++')
    const jsonData = await APIQuery(prompt, myChat.text)
    res.write(`\n${JSON.stringify({ text: '浏览器查询语料生成完成...' })}`)

    console.log('jsonData --> ', jsonData)
    console.log('+++++++++++++++++++++++++++++++++++++++++')
    const callRes = await search(jsonData, 5, res)
    res.write(`\n${JSON.stringify({ text: '浏览器查询完成,正在生成反馈结果...' })}`)
    console.log('callRes --> ', callRes)

    let ReplySumPrompt = promptObject.ReplySumPrompt
    // let apicalls = String(callRes)
    // if (apicalls.length > 2000)
    // 	apicalls = apicalls.slice(0, -100)

    ReplySumPrompt = ReplySumPrompt.replace('{query}', `Query: ${prompt}`)
    ReplySumPrompt = ReplySumPrompt.replace('{apicalls}', callRes)

    console.log('ReplySumPrompt --> ', ReplySumPrompt)

    return ReplySumPrompt
  }
  catch (error) {
    return `error: 浏览器查询执行失败：${error.message}`
  }
}

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')
  console.error('req.body -> ', req.body)

  let myChat: ChatMessage | undefined
  let { prompt, querymethod, options = {}, systemMessage, temperature, device, username, telephone } = req.body as RequestProps

  querymethod = querymethod || 'ChatGPT'
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

    const userList = await sqlDB.select('userinfo', { where: { username, telephone } })
    if (userList.length || !process.env.AUTH_SECRET_KEY) {
      const nowDate = dateFormat(new Date(), 'yyyyMMdd')
      if (process.env.AUTH_SECRET_KEY && userList[0].status === '3') {
        console.error('用户已被禁用，请联系管理员！')
        dbRecord.conversation = '用户已被禁用，请联系管理员！'
        dbRecord.finish_reason = 'stop'
        res.write(JSON.stringify({ message: dbRecord.conversation }))
      }
      else if (process.env.AUTH_SECRET_KEY && userList[0].expired <= nowDate) {
        dbRecord.conversation = '账户已过期，请联系管理员进行充值服务！微信：18514665919'
        dbRecord.finish_reason = 'stop'
        res.write(JSON.stringify({ message: dbRecord.conversation }))
      }
      else {
        prompt = prompt.trim()

        if (prompt) {
          let qianzhui = ''
          if (prompt.startsWith('/') || prompt.startsWith('！')) {
            const result = await executeCommand(prompt, dbRecord)
            if (result.startsWith('error:')) {
              dbRecord.conversation = result
        			dbRecord.finish_reason = 'stop'
              res.write(JSON.stringify({ message: dbRecord.conversation }))
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
            if (querymethod === 'ChatGPT Browser') {
              prompt = await chatGPTBrowser(prompt, res)
              if (prompt.startsWith('error:')) {
                systemMessage = ''
                dbRecord.conversation = prompt
        				dbRecord.finish_reason = 'stop'
                res.write(JSON.stringify({ message: dbRecord.conversation }))
              }
              else {
                options = null
                systemMessage = 'You are a web-based large language model, Respond conversationally.Remember to specify the programming language after the first set of three backticks (```) in your code block. Additionally, wrap mathematical formulas in either $$ or $$$$.'
                qianzhui = '【ChatGPT Browser】'
              }
            }
            else {
              systemMessage = `current Time: ${dateFormat(new Date(new Date().getTime() + 8 * 60 * 60 * 1000), 'yyyy年MM月dd日 hh时mm分ss秒')}\n\n这个网站的提供者: 马少杰，他是一个为人友善、热爱技术、喜欢小动物的人，他的联系方式[手机号/微信]：18514665919\n\n${systemMessage}。`
            }

            if (systemMessage) {
              let firstChunk = true
              await chatReplyProcess({
                message: prompt,
                lastContext: options,
                process: (chat: ChatMessage) => {
                  if (firstChunk) {
                    chat.text = `${qianzhui}${chat.text}`
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
            }
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
      if (sqlDB && dbRecord.id && myChat) {
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
  const systemMessage = `current Time: ${dateFormat(new Date(new Date().getTime() + 8 * 60 * 60 * 1000), 'yyyy年MM月dd日 hh时mm分ss秒')}\n\n这个网站的提供者: 马少杰，他是一个为人友善、热爱技术、喜欢小动物的人，他的联系方式[手机号/微信]：18514665919\n\n您是一个知识渊博的学者，基于openai公司的chatgpt3.5版本，有着极其严谨而又风趣的聊天态度，请尽可能准确详细的回答问题。`
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

      if (telephone === '18514665919' && prompt.startsWith('/')) {
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
