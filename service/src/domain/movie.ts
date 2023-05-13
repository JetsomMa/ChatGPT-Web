import fetch from 'node-fetch'
import httpsProxyAgent from 'https-proxy-agent'
import type { ChatMessage } from '../chatgpt'
import { chatReplyProcess } from '../chatgpt'

const { HttpsProxyAgent } = httpsProxyAgent

async function getWebsitContent(url) {
  if (process.env.HTTPS_PROXY) {
    const httpsProxy = process.env.HTTPS_PROXY
    if (httpsProxy) {
      const agent = new HttpsProxyAgent(httpsProxy)
      const response = await fetch(url, { agent })
      return await response.json()
    }
  }
  else {
    const response = await fetch(url)
    return await response.json()
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

function clean_string(inputStr) {
  let res = remove_html_tags(inputStr)
  // Replace multiple spaces with a single space
  res = inputStr.replace(/\s+/g, ' ')
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
  res = res.replace(/ /g, '')
  res = res.replace(/<.+?>/g, '') // Remove HTML tags
  // res = res.replace(/\W{2,}/g, '')
  res = res.replace(/(\d) +(\d)/g, '$1,$2')
  res = res.trim() // Remove leading/trailing spaces
  return res
}

async function WikiQuery(prompt, num) {
  const queryUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(prompt)}`
  console.log('queryUrl --> ', queryUrl)
  const response: any = await getWebsitContent(queryUrl)
  if (response) {
    const data = (response.query.search || []).slice(0, num)
    const results = data.map(d => ({ title: `[维基百科]${d.title}`, src: `https://zh.wikipedia.org/wiki/${encodeURIComponent(d.title)}`, content: clean_string(d.snippet) }))

    return results
  }
  else {
    return []
  }
}

async function executeCommand(prompt) {
  try {
    const url = `http://118.195.236.91:5001/movies?type=full&count=5&q=${encodeURIComponent(prompt)}`
    console.log('url --> ', url)
    const response = await fetch(url)
    let json: any = await response.json()

    if (json && json.length) {
      const promiseArray = []
      json = json.filter((item: any) => (item.rating > 0))
      json.forEach((element) => {
        promiseArray.push(fetch(`http://118.195.236.91:5001/movies/${element.sid}/celebrities`))
      })

      const responseArray = await Promise.all(promiseArray)
      for (let i = 0; i < responseArray.length; i++) {
        const rolesResponse = responseArray[i]
        const jsonRoles = await rolesResponse.json()
        json[i].roles = jsonRoles.slice(0, 10)
      }

      let finalList = json.map((item: any) => {
      	const newItem = {
          电影名: item.name,
          评分: item.rating,
          导演: item.director,
          作者: item.writer,
          国家: item.country,
          语言: item.language,
          上映时间: item.screen,
          影片时长: item.duration,
          剧情简介: item.intro.replace(/[\n]/g, ''),
          演员名单: item.roles.map((role: any) => {
            if (role.role === '导演')
              return ''

            else if (role.role === '演员')
              return role.name

            else
              return `${role.name} 饰 ${role.role}`
          }).join('、'),
      	}

        return newItem
      })

      finalList = finalList.filter((item: any) => (item['剧情简介'].length > 40 && item['演员名单'].length > 0))
      finalList = finalList.map((item: any) => {
        let itemString = ''
        Object.keys(item).forEach((key) => {
          if (key !== '电影名')
            itemString += `${key}${item[key]}`
        })

        const itemObject: any = {}
        itemObject.title = `[豆瓣]${item['电影名']}`
        itemObject.src = `https://www.douban.com/search?q=${encodeURIComponent(item['电影名'])}`
        itemObject.content = clean_string(itemString)
        return itemObject
      }).slice(0, 3)

      // const wikiList = await WikiQuery(prompt, 1)

      // finalList = finalList.concat(wikiList)

      if (finalList.length === 0)
        return `error: 没有找到与${prompt}相关的影视作品。`

      const finalListString = JSON.stringify(finalList)
      return finalListString
    }
  }
  catch (error) {
    return `error: 指令执行失败：${error.message}`
  }
}

export async function replyMovie(prompt, dbRecord, res) {
  const replySystemMessage = `请你扮演一个内容编辑角色，用户将输入一个json数组。请将内容按照下面示例转换成markdown格式输出。

以下是一些内容生成的示例：

输入：[{"title":"[豆瓣]电影名称","src":"https://www.douban.com/search?q=电影名称","content":"评分xx导演xx作者xxx/xxx/xxx/xxx国家xxxx语言xx/xx/xx/xx/xx上映时间xxxxxxxxxx影片时长xxxx剧情简介xxxxxxxxxxxxx演员名单xxxxxxxxxxx"}]
输出：### [[豆瓣]电影名称](https://www.douban.com/search?q=电影名称)
评分：xx
导演：xx
作者：xxx/xxx/xxx/xxx
国家：xxxx
语言：xx/xx/xx/xx/xx
上映时间：xxxxxxxxxx
影片时长：xxxx
剧情简介：xxxxxxxxxxxxx
演员名单：xxxxxxxxxxx


如果文中出现了英语，请将其转换成为中文输出。
`

  const result = await executeCommand(prompt)

  if (result.startsWith('error:')) {
    dbRecord.conversation = result
    dbRecord.finish_reason = 'stop'
    res.write(JSON.stringify({ message: dbRecord.conversation }))
  }
  else {
    try {
      let firstChunk = true
      let myChat: ChatMessage | undefined
      await chatReplyProcess({
        message: result,
        process: (chat: ChatMessage) => {
          res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
          firstChunk = false
          myChat = chat
        },
        systemMessage: replySystemMessage,
        temperature: 0,
      })

      if (myChat) {
        dbRecord.conversation = myChat.text
        dbRecord.conversationId = myChat.id
        dbRecord.finish_reason = myChat.detail.choices[0].finish_reason
      }
    }
    catch (error) {
      res.write(JSON.stringify({ message: error.message }))
    }
  }
}
