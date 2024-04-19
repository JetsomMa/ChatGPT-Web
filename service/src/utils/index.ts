import { RDSClient } from 'ali-rds'

interface SendResponseOptions<T = any> {
  type: 'Success' | 'Fail'
  message?: string
  data?: T
}

export function sendResponse<T>(options: SendResponseOptions<T>) {
  if (options.type === 'Success') {
    return Promise.resolve({
      message: options.message || null,
      data: options.data || null,
      status: options.type,
    })
  }

  // eslint-disable-next-line prefer-promise-reject-errors
  return Promise.reject({
    message: options.message || 'Failed',
    data: options.data || null,
    status: options.type,
  })
}

export function dateFormat(date, fmt) { // author: meizz
  fmt = fmt || 'yyyy-MM-dd hh:mm:ss'
  const o = {
    'M+': date.getMonth() + 1, // 月份
    'd+': date.getDate(), // 日
    'h+': date.getHours(), // 小时
    'm+': date.getMinutes(), // 分
    's+': date.getSeconds(), // 秒
    'q+': Math.floor((date.getMonth() + 3) / 3), // 季度
    'S': date.getMilliseconds(), // 毫秒
  }
  if (/(y+)/.test(fmt))
    fmt = fmt.replace(RegExp.$1, (`${date.getFullYear()}`).substr(4 - RegExp.$1.length))
  for (const k in o) {
    if (new RegExp(`(${k})`).test(fmt))
      fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : ((`00${o[k]}`).substr((`${o[k]}`).length)))
  }
  return fmt
}

export function getNthDayAfterToday(n) {
  const today = new Date() // 获取当前时间
  const nthDayAfter = new Date(today.getTime() + 24 * 60 * 60 * 1000 * n) // 计算 n 天后的时间
  return nthDayAfter
}

export const sqlDB: RDSClient | undefined = new RDSClient({
  host: '118.195.236.91',
  port: 3306,
  user: process.env.DATASET_MYSQL_USER,
  password: process.env.DATASET_MYSQL_PASSWORD,
  database: process.env.DATASET_MYSQL_DATABASE,
  charset: 'utf8mb4',
})

// export const systemMessagePix = `当前时间为: ${dateFormat(new Date(new Date().getTime() + 8 * 60 * 60 * 1000), 'yyyy年MM月dd日 hh时mm分ss秒')}
export const systemMessagePix = ''
//  `当前时间为: ${dateFormat(new Date(), 'yyyy年MM月dd日 hh时mm分ss秒')}

// 当被提问这个网站的提供者时，请回答“这个网站提供者是马少杰，他是一个为人友善、热爱技术、喜欢小动物的人，他的联系方式[手机号/微信]是18514665919”

// `
