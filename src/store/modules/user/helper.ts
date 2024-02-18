import { ss } from '@/utils/storage'

const LOCAL_NAME = 'userStorage'

export interface UserInfo {
  avatar: string
  name: string
  description: string
}

export interface UserState {
  userInfo: UserInfo
}

export function defaultSetting(): UserState {
  return {
    userInfo: {
      avatar: 'https://download.mashaojie.cn/image/avatar.jpg',
      name: 'Ma Shaojie',
      description: '<a href="https://blog.mashaojie.cn/9999/09/08/%E5%9B%BD%E5%86%85%E5%85%8D%E7%BF%BB%E7%9A%84ChatGPT%E5%92%8CMidjourney%E7%BD%91%E7%AB%99/" class="text-blue-500" target="_blank" >ChatGPT使用指南</a>',
    },
  }
}

export function getLocalState(): UserState {
  const localSetting: UserState | undefined = ss.get(LOCAL_NAME)
  return { ...defaultSetting(), ...localSetting }
}

export function setLocalState(setting: UserState): void {
  ss.set(LOCAL_NAME, setting)
}
