import type { FetchFn } from 'chatgpt'

export interface RequestProps {
  prompt: string
  querymethodt: string
  options?: ChatContext
  systemMessage: string
  temperature?: number
  device?: string
  username?: string
  telephone?: string
}

export interface ChatContext {
  conversationId?: string
  parentMessageId?: string
}

export interface ChatGPTUnofficialProxyAPIOptions {
  accessToken: string
  apiReverseProxyUrl?: string
  model?: string
  debug?: boolean
  headers?: Record<string, string>
  fetch?: FetchFn
}

export interface ModelConfig {
  apiModel?: ApiModel
  reverseProxy?: string
  timeoutMs?: number
  socksProxy?: string
  httpsProxy?: string
  balance?: string
}

export interface VerifyProps {
  token: string
  username: string
  telephone: string
  remark: string
  phonecode: string
}

export type ApiModel = 'ChatGPTAPI' | 'ChatGPTUnofficialProxyAPI' | string | undefined
