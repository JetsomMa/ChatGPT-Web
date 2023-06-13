export interface MJConfig {
  ChannelId: string
  SalaiToken: string
  Debug: boolean
  Limit: number
  MaxWait: number
  SessionId: string
  ServerId?: string
  Ws?: boolean
  HuggingFaceToken?: string
  DiscordBaseUrl: string
  WsBaseUrl: string
}
export interface MJConfigParam {
  SalaiToken: string
  ChannelId?: string
  Debug?: boolean
  Limit?: number
  MaxWait?: number
  Ws?: boolean
  HuggingFaceToken?: string
  ServerId?: string
  SessionId?: string
  DiscordBaseUrl?: string
  WsBaseUrl?: string
}

export const DefaultMJConfig: MJConfig = {
  ChannelId: '1077800642086703114',
  SalaiToken: '',
  SessionId: '8bb7f5b79c7a49f7d0824ab4b8773a81',
  Debug: false,
  Limit: 50,
  MaxWait: 100,
  DiscordBaseUrl: 'https://discord.com',
  WsBaseUrl: 'wss://gateway.discord.gg?v=9&encoding=json&compress=gzip-stream`',
}
