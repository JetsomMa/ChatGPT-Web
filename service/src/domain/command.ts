import { sqlDB } from '../utils'
import type { ChatMessage } from '../chatgpt'
import { chatReplyProcess } from '../chatgpt'

const tableInfo = `用户信息表：userinfo
id: 用户id
username: 用户名
telephone: 手机号
status: 状态 [0-未激活，2-已激活，3-已禁用]
expired: 过期时间
remark: 备注
chatgptday: 每日免费chatgpt请求次数
dallemonth: 每月免费画画次数
dalleday: 每日免费画画次数
extenddalle: 充值画画次数

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
      Q: "/查询 用户信息18514665919"
      A: { "operate": "query", sql:"SELECT id,username,telephone,status,expired,remark,chatgptday,dallemonth,dalleday,extenddalle FROM userinfo where telephone = '18514665919'", "level": "S" }
      Q: "/查询 马少杰的电话、状态和过期时间"
      A: { "operate": "query", sql:"SELECT id,telephone,status,expired FROM userinfo where username = '马少杰'", "level": "S" }
      Q: "/查询 李振华的提问"
      A: { "operate": "query", sql:"SELECT id,prompt FROM chatweb where username = '李振华'", "level": "S" }
      Q: "/查询 我的过期时间"
      A: { "operate": "query", sql:"SELECT id,expired FROM userinfo where telephone=:telephone", "level": "A" }
      Q: "/查询 我的信息"
      A: { "operate": "query", sql:"SELECT id,username,telephone,status,expired,remark,chatgptday,dallemonth,dalleday,extenddalle FROM userinfo where telephone=:telephone", "level": "A" }
      Q: "/查询 我的提问"
      A: { "operate": "query", sql:"SELECT id,prompt FROM chatweb where telephone=:telephone", "level": "A" }

      Q: "/操作 激活12399998888"
      A: { "operate": "update", "table": "userinfo", "row": { "status": "2" }, "where": { "telephone": "12399998888" }, "level": "S" }
      Q: "/操作 禁用李振华"
      A: { "operate": "update", "table": "userinfo", "row": { "status": "3" }, "where": { "username": "李振华" }, "level": "S" }
      Q: "/操作 禁用13677776666"
      A: { "operate": "update", "table": "userinfo", "row": { "status": "3" }, "where": { "telephone": "13677776666" }, "level": "S" }
      Q: "/操作 修改用户13677776666的extenddalle字段为20"
      A: { "operate": "update", "table": "userinfo", "row": { "extenddalle": 20 }, "where": { "telephone": "13677776666" }, "level": "S" }
      Q: "/操作 充值18514665919"
      A: { "operate": "queryupdate", "sql": "UPDATE userinfo SET expired = DATE_FORMAT(DATE_ADD(STR_TO_DATE(expired, '%Y%m%d'), INTERVAL 1 MONTH), '%Y%m%d') where telephone = '18514665919', "table": "userinfo", "where": { "telephone": "18514665919" }, "level": "S" }
  `

export const resultCommandMessage = `您将扮演一个翻译员的角色，帮我格式化这个输出结果，如果包含json则整理成表格，请保持严谨，不要伪造信息，不要有额外的解释和说明。
  ${tableInfo}

  问答的示例：[Q: 问题  A: 回答]
    Q: '[{"expired":"20230630"}]'
    A: "| expired |\n|-----------|\n| 20230630|"
`
export async function executeCommand(prompt, record) {
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

    console.log('指令生成的结果 --> ', command)

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

export async function replyCommand(prompt, dbRecord, res) {
  const result = await executeCommand(prompt, dbRecord)
  if (result.startsWith('error:')) {
    dbRecord.conversation = result
    dbRecord.finish_reason = 'stop'
    res.write(JSON.stringify({ message: dbRecord.conversation }))
  }
  else {
    try {
      let firstChunk = true
      let myChat: any | undefined
      await chatReplyProcess({
        message: result,
        process: (chat: ChatMessage) => {
          res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
          firstChunk = false

          myChat = chat
        },
        systemMessage: resultCommandMessage,
        temperature: 0,
      })

      myChat.finish = true
      res.write(`\n${JSON.stringify(myChat)}`)

      if (myChat) {
        dbRecord.conversation = myChat.text
        dbRecord.conversationId = myChat.id
        dbRecord.finish_reason = myChat.detail.choices[0].finish_reason
      }
    }
    catch (error) {
      res.write(JSON.stringify({ message: `${error.message}\n请联系管理员，微信：18514665919\n![](https://chat.mashaojie.cn/download/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg)` }))
    }
  }
}
