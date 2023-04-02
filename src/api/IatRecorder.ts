/* eslint-disable @typescript-eslint/no-use-before-define */
import CryptoJS from 'crypto-js'
const TransWorker = new Worker('./transcode.worker.js')

export interface StatusChange {
  status: string
  statusOld: string
}
/**
 * 获取websocket url
 * 该接口需要后端提供，这里为了方便前端处理
 */
export class IatRecorder {
  apiSecret: string
  apiKey: string
  appId: string
  language?: string
  accent?: string

  webSocket: any
  audioData: any[]
  status: 'init' | 'doing' | 'end'
  scriptProcessor: any
  audioContext: any
  mediaSource: any
  resultTextTmp: string
  resultText: string

  onStatusChange?: (statusObject: StatusChange) => void | undefined
  onTextChange?: () => void | undefined
  handlerInterval: any
  finallyFunction: any
  mediaStream: any

  constructor({ appId = '', apiKey = '', apiSecret = '', language = 'zh_cn', accent = 'mandarin' }) {
    this.appId = appId
    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.language = language
    this.accent = accent

    this.status = 'end'
    // 初始化浏览器录音
    this.recorderInit()
    // 记录音频数据
    this.audioData = []
    // 记录听写结果
    this.resultTextTmp = ''
    // wpgs下的听写结果需要中间状态辅助记录
    this.resultText = ''
    TransWorker.onmessage = (event) => {
      this.audioData.push(...event.data)
    }
  }

  destroy() {
    this.webSocket && this.webSocket.close()
    // 停止ScriptProcessorNode节点的处理
    this.scriptProcessor && this.scriptProcessor.disconnect()
    // 停止MediaStreamAudioSourceNode节点的播放
    this.mediaSource && this.mediaSource.disconnect()
    // 关闭音频上下文
    this.audioContext && this.audioContext.close()

    // 停止MediaStreamTrack的播放
    if (this.mediaStream) {
      const tracks = this.mediaStream.getTracks()
      tracks.forEach((track: { stop: () => any }) => track.stop())
      this.mediaStream = undefined
    }
  }

  destroyWorker() {
    TransWorker.terminate()
  }

  // 初始化浏览器录音
  recorderInit() {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia

    // 创建音频环境
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.audioContext.suspend()
      window.audioContext = this.audioContext
      if (!this.audioContext) {
        alert('浏览器不支持webAudioApi相关接口')
        return
      }
    }
    catch (e) {
      if (!this.audioContext) {
        alert('浏览器不支持webAudioApi相关接口')
        return
      }
    }

    // 获取浏览器录音权限
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then((mediaStream) => {
          getMediaSuccess(mediaStream)
        })
        .catch((e) => {
          getMediaFail(e)
        })
    }
    else if (navigator.getUserMedia) {
      navigator.getUserMedia({ audio: true, video: false },
        (mediaStream: any) => {
          getMediaSuccess(mediaStream)
        },
        (error: any) => {
          getMediaFail(error)
        },
      )
    }
    else {
      if (navigator.userAgent.toLowerCase().match(/chrome/) && !location.origin.includes('https://'))
        alert('chrome下获取浏览器录音功能，因为安全性问题，需要在localhost或127.0.0.1或https下才能获取权限')

      else
        alert('无法获取浏览器录音功能，请升级浏览器或使用chrome')

      this.audioContext && this.audioContext.close()
      this.audioContext = undefined
      return
    }
    // 获取浏览器录音权限成功的回调
    let getMediaSuccess: (mediaStream: any) => void = (mediaStream) => {
      this.mediaStream = mediaStream
      // 创建一个用于通过JavaScript直接处理音频
      this.scriptProcessor = this.audioContext.createScriptProcessor(0, 1, 1)
      this.scriptProcessor.onaudioprocess = (e: { inputBuffer: { getChannelData: (arg0: number) => any } }) => {
        // 去处理音频数据
        if (this.status === 'doing' && this.audioContext.state === 'running')
          TransWorker.postMessage(e.inputBuffer.getChannelData(0))
      }
      // 创建一个新的MediaStreamAudioSourceNode 对象，使来自MediaStream的音频可以被播放和操作
      this.mediaSource = this.audioContext.createMediaStreamSource(mediaStream)
      // 连接
      this.mediaSource.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.audioContext.destination)
    }

    let getMediaFail: (mediaStream: any) => void = (error) => {
      // eslint-disable-next-line no-alert
      alert('请求麦克风失败')
      console.error('请求麦克风失败', error)
      this.audioContext && this.audioContext.close()
      this.audioContext = undefined
    }
  }

  // 修改录音听写状态
  setStatus(status: 'init' | 'doing' | 'end') {
    if (this.onStatusChange && this.status !== status) {
      this.onStatusChange({ status, statusOld: this.status })
      this.status = status
    }
  }

  // 开始语音识别
  start() {
    if (this.audioContext) {
      this.audioContext.resume()
      this.connectWebSocket()
    }
    else {
      alert('浏览器不支持录音!')
    }
  }

  // 停止录音
  stop() {
    if (this.audioContext) {
      this.audioContext.suspend()
      this.setStatus('end')
    }
  }

  // 连接websocket
  connectWebSocket() {
    // 请求地址根据语种不同变化
    let url = 'wss://iat-api.xfyun.cn/v2/iat'
    const host = 'iat-api.xfyun.cn'
    const date = new Date().toGMTString()
    const algorithm = 'hmac-sha256'
    const headers = 'host date request-line'
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, this.apiSecret)
    const signature = CryptoJS.enc.Base64.stringify(signatureSha)
    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`
    const authorization = btoa(authorizationOrigin)
    url = `${url}?authorization=${authorization}&date=${date}&host=${host}`

    if ('WebSocket' in window) {
      this.webSocket = new WebSocket(url)
    }
    else if ('MozWebSocket' in window) {
      this.webSocket = new MozWebSocket(url)
    }
    else {
      alert('浏览器不支持WebSocket')
      return
    }

    this.setStatus('init')
    this.webSocket.onopen = () => {
      if (this.status === 'init') {
        this.setStatus('doing')
        // 重新开始录音
        setTimeout(() => {
          this.sendAudioToWebSocket()
        }, 100)
      }
    }
    this.webSocket.onmessage = (e: { data: any }) => {
      this.result(e.data)
    }
    this.webSocket.onerror = (error: any) => {
      // eslint-disable-next-line no-alert
      alert('websocket连接失败')
      console.error('webSocket onerror', error)
      this.stop()
    }
    this.webSocket.onclose = (error: any) => {
      console.log('webSocket onclose', error)
      this.stop()
    }
  }

  // 向webSocket发送数据
  sendAudioToWebSocket() {
    if (this.webSocket.readyState !== 1)
      return

    let audioData = this.audioData.splice(0, 1280)
    const params = {
      common: {
        app_id: this.appId,
      },
      business: {
        language: this.language, // 小语种可在控制台--语音听写（流式）--方言/语种处添加试用
        domain: 'iat',
        accent: this.accent, // 中文方言可在控制台--语音听写（流式）--方言/语种处添加试用
        vad_eos: 5000,
        dwa: 'wpgs', // 为使该功能生效，需到控制台开通动态修正功能（该功能免费）
      },
      data: {
        status: 0,
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: this.toBase64(audioData),
      },
    }
    this.webSocket.send(JSON.stringify(params))
    // 间隔40ms发送一帧音频
    this.handlerInterval = setInterval(() => {
      // websocket未连接
      if (this.webSocket.readyState !== 1) {
        this.audioData = []
        clearInterval(this.handlerInterval)
        this.handlerInterval = undefined
        return
      }
      if (this.audioData.length === 0) {
        if (this.status === 'end') {
          this.webSocket.send(
            JSON.stringify({
              data: {
                status: 2,
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio: '',
              },
            }),
          )
          this.audioData = []
          clearInterval(this.handlerInterval)
          this.handlerInterval = undefined
        }
        return false
      }
      else {
        audioData = this.audioData.splice(0, 1280)
        // 中间帧
        this.webSocket.send(
          JSON.stringify({
            data: {
              status: 1,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: this.toBase64(audioData),
            },
          }),
        )
      }
    }, 40)
  }

  // 对处理后的音频数据进行base64编码，
  toBase64(buffer: Iterable<number>) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++)
      binary += String.fromCharCode(bytes[i])

    return window.btoa(binary)
  }

  result(resultData: string) {
    // 识别结束
    const jsonData = JSON.parse(resultData)
    if (jsonData.data && jsonData.data.result) {
      const data = jsonData.data.result
      let str = ''
      const ws = data.ws
      for (let i = 0; i < ws.length; i++)
        str = str + ws[i].cw[0].w

      // 开启pgs会有此字段(前提：在控制台开通动态修正功能)
      if (data.pgs) {
        // 取值为 "apd"时表示该片结果是最终结果；//// 取值为"rpl" 时表示替换前面的部分结果，替换范围为rg字段
        if (data.pgs === 'apd') {
          // 将resultTextTemp同步给resultText
          this.resultTextTmp = this.resultText
        }
        // 将结果存储在resultTextTemp中
        this.resultText = this.resultTextTmp + str
        this.onTextChange && this.onTextChange()
      }
      else {
        this.resultTextTmp = this.resultTextTmp + str
        this.onTextChange && this.onTextChange()
      }
    }

    if (jsonData.code === 0 && jsonData.data.status === 2) {
      this.finallyFunction && this.finallyFunction(this.resultText)
      this.resultText = ''
      this.resultTextTmp = ''
      this.webSocket && this.webSocket.close()
    }

    if (jsonData.code !== 0)
      this.webSocket && this.webSocket.close()
  }
}
