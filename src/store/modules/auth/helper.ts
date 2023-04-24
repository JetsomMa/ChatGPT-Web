import { ss } from '@/utils/storage'

const SECRET_TOKEN = 'SECRET_TOKEN'
const LOCAL_NAME = 'LOCAL_NAME'
const LOCAL_PHONE = 'LOCAL_PHONE'

export function getToken() {
  const token = ss.get(SECRET_TOKEN)
  const username = ss.get(LOCAL_NAME)
  const telephone = ss.get(LOCAL_PHONE)
  return { token, username, telephone }
}

export function setToken(token: string, username: string, telephone: string) {
  ss.set(SECRET_TOKEN, token)
  ss.set(LOCAL_NAME, username)
  ss.set(LOCAL_PHONE, telephone)
}

export function removeToken() {
  ss.remove(SECRET_TOKEN)
  ss.remove(LOCAL_NAME)
  ss.remove(LOCAL_PHONE)
}
