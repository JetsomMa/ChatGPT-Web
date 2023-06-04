// import fs from 'fs'
// import path from 'path'
import axios from 'axios'
// import httpsProxyAgent from 'https-proxy-agent'
// const { HttpsProxyAgent } = httpsProxyAgent

// const agent = process.env.HTTPS_PROXY ? new HttpsProxyAgent(process.env.HTTPS_PROXY) : null
// const apikey = process.env.OPENAI_API_KEY
const apikey = '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'
export async function replyDalle(prompt, dbRecord, res) {
  try {
    res.write(`\n${JSON.stringify({ text: '图片生成中，请稍后...' })}`)

    const response = await axios.post('http://118.195.236.91:3011/api/createImage', { prompt, apikey })

    if (response.status === 200 && response.data) {
      console.warn('response.data.data -> ', response.data.data)

      for (let i = 0; i < response.data.data.length; i++) {
        const item = response.data.data[i]
        const fileName = `${dbRecord.telephone}_${new Date().getTime()}.png`
        const resp: any = await axios.post('http://118.195.236.91:3011/api/downloadImage', { imageUrl: item.url, fileName })
        if (resp.status !== 200) {
          res.write(`\n${JSON.stringify({ text: resp.message })}`)
          return
        }
        item.url = `https://chat.mashaojie.cn/download/images/dalle/${fileName}`
      }

      let resultText = ''
      response.data.data.forEach((item) => {
        resultText += `![](${item.url})[下载文件](${item.url})\n\n`
      })
      res.write(`\n${JSON.stringify({ text: resultText })}`)

      dbRecord.conversation = resultText
      dbRecord.conversationId = `图片生成_${dbRecord.username}_${dbRecord.telephone}`
      dbRecord.finish_reason = 'stop'
    }
    else {
      res.write(`\n${JSON.stringify({ text: '图片生成失败！！！' })}`)
      dbRecord.conversationId = `图片生成_${dbRecord.username}_${dbRecord.telephone}`
    }
  }
  catch (error) {
    res.write(JSON.stringify({ message: error.message }))
  }
}

// async function downloadImage(imageUrl, fileName) {
//   try {
//     const dir = '/var/images/dalle'
//     if (!fs.existsSync(dir))
//       fs.mkdirSync(dir, { recursive: true })

//     const localPath = `${dir}/${fileName}`
//     // 发送HTTP请求获取图片
//     const options: any = {
//       method: 'get',
//       url: imageUrl,
//       responseType: 'stream',
//     }
//     options.httpsAgent = agent
//     const response = await axios(options)

//     // 创建可写流
//     const fileStream = fs.createWriteStream(path.resolve(localPath))

//     // 将响应管道传输到文件流
//     response.data.pipe(fileStream)

//     return new Promise((resolve, reject) => {
//       fileStream.on('finish', resolve)
//       fileStream.on('error', reject)
//     })
//   }
//   catch (error) {
//     console.error(error)
//   }
// }
