import { MessageCenter, Request, catchAwait } from 'utils-lib-js'

// 请求对话信息接口的响应信息
export interface IBingInfo {
  clientId: string
  conversationId: string
  conversationSignature: string
  result: {
    message: unknown
    value: string
  }
}
// 切换可选项，防止报错
export type IBingInfoPartial = Partial<IBingInfo>
// 静态配置项结构
export interface IConfig {
  cookie: string
  proxyUrl: string
  bingUrl: string
  bingSocketUrl: string
}
// NewBingServer的构造函数配置
export interface IOpts {
  agent: any
}
export class NewBingServer extends MessageCenter {
  bingInfo: IBingInfo
  readonly bingRequest: Request
  constructor(private opts: IOpts, private _config: IConfig = config) {
    super()
    const { bingUrl } = this._config
    this.bingRequest = new Request(bingUrl)// 初始化请求地址
    this.initServer()// 初始化request: 拦截器等
  }

  // 抛错事件
  throwErr(err: any) {
    console.error(err)
    this.emit('new-bing:server:error', err)
  }

  // 赋值当前请求的信息
  async initConversation() {
    this.bingInfo = await this.createConversation()
  }

  // 初始化request
  initServer() {
    this.bingRequest.use('error', console.error)
    // .use("response", console.log)
  }

  // 发起请求
  private async createConversation() {
    const { _config, opts, bingInfo } = this
    const { agent } = opts
    if (bingInfo)
      return bingInfo
    const { cookie } = _config
    const options: any = {
      headers: { cookie },
    }
    if (agent)
      options.agent = agent

    const [err, res] = await catchAwait(this.bingRequest.GET('/turing/conversation/create', {}, null, options))
    if (err)
      return this.throwErr(err)
    return res
  }
}
