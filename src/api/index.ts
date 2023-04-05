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
export function fetchChatAPIProcess<T = any>(
  params: {
    prompt: string
    options?: { conversationId?: string; parentMessageId?: string }
    signal?: GenericAbortSignal
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
) {
  const settingStore = useSettingStore()
  let queryData = JSON.stringify({ prompt: params.prompt, options: params.options, systemMessage: settingStore.systemMessage, temperature: settingStore.temperature })

  if (!AESKey) {
    // 加密
    const authStore = useAuthStore()
    AESKey = CryptoJS.MD5(authStore.token || '1234567890123456').toString()
  }

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

export function fetchVerify<T>(token: string) {
  return post<T>({
    url: '/verify',
    data: { token },
  })
}
