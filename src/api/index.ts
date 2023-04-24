import type { AxiosProgressEvent, GenericAbortSignal } from 'axios'
import CryptoJS from 'crypto-js'
import { post } from '@/utils/request'
import { useAuthStore, useSettingStore } from '@/store'

export function fetchChatAPI<T = any>(
  prompt: string,
  options?: { conversationId?: string; parentMessageId?: string },
  signal?: GenericAbortSignal,
) {
  return post<T>({
    url: '/chat',
    data: { prompt, options },
    signal,
  })
}

export function fetchChatConfig<T = any>() {
  return post<T>({
    url: '/config',
  })
}

let AESKey: string
const parser = new window.UAParser(navigator.userAgent)
const parserResults = parser.getResult()
const device = `device: ${parserResults.device.vendor || ''} ${parserResults.device.type || ''} ${parserResults.device.model || ''}| os: ${parserResults.os.name || ''} ${parserResults.os.version || ''}| browser: ${parserResults.browser.name || ''} ${parserResults.browser.version || ''}| engine: ${parserResults.engine.name || ''} ${parserResults.engine.version || ''}`
export function fetchChatAPIProcess<T = any>(
  params: {
    prompt: string
    options?: { conversationId?: string; parentMessageId?: string }
    signal?: GenericAbortSignal
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
) {
  const settingStore = useSettingStore()
  const authStore = useAuthStore()

  let queryData = JSON.stringify({ username: authStore.username, prompt: params.prompt, options: params.options, systemMessage: settingStore.systemMessage, temperature: settingStore.temperature, device })

  if (!AESKey)
    AESKey = CryptoJS.MD5(authStore.token || '1234567890123456').toString()

  queryData = CryptoJS.AES.encrypt(queryData, AESKey, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString()

  return post<T>({
    url: '/chat-process',
    data: { queryData },
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
  })
}

export function fetchSession<T>() {
  return post<T>({
    url: '/session',
  })
}

interface VerifyProps {
  token: string
  username: string
  telephone: string
}
export function fetchVerify<T>(data: VerifyProps) {
  return post<T>({
    url: '/verify',
    data,
  })
}
