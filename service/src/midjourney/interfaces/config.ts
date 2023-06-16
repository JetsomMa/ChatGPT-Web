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
  ApplicationId: string
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
  ApplicationId: '936929561302675456',
  ChannelId: '1109565631214387222',
  SalaiToken: '',
  SessionId: '87a6cfdc16133a4655b8bae8695047bf',
  Debug: false,
  Limit: 50,
  MaxWait: 100,
  DiscordBaseUrl: 'https://discord.com',
  WsBaseUrl: 'wss://gateway.discord.gg?v=9&encoding=json&compress=gzip-stream`',
}
