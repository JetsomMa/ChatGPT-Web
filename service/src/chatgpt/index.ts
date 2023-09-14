import * as dotenv from 'dotenv'
import 'isomorphic-fetch'
import type { ChatGPTAPIOptions, ChatMessage, SendMessageOptions } from 'chatgpt'
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt'
import { SocksProxyAgent } from 'socks-proxy-agent'
import httpsProxyAgent from 'https-proxy-agent'
import fetch from 'node-fetch'
import axios from 'axios'
import { sendResponse } from '../utils'
import { isNotEmptyString } from '../utils/is'
import type { ApiModel, ChatContext, ChatGPTUnofficialProxyAPIOptions, ModelConfig } from '../types'
import type { RequestOptions } from './types'

const { HttpsProxyAgent } = httpsProxyAgent

dotenv.config()

const ErrorCodeMessage: Record<string, string> = {
  401: '[OpenAI] 提供错误的API密钥 | Incorrect API key provided',
  403: '[OpenAI] 服务器拒绝访问，请稍后再试 | Server refused to access, please try again later',
  502: '[OpenAI] 错误的网关 |  Bad Gateway',
  503: '[OpenAI] 服务器繁忙，请稍后再试 | Server is busy, please try again later',
  504: '[OpenAI] 网关超时 | Gateway Time-out',
  500: '[OpenAI] 服务器繁忙，请稍后再试 | Internal Server Error',
}

const timeoutMs: number = 300 * 1000

let apiModel: ApiModel

if (!isNotEmptyString(process.env.OPENAI_API_KEY) && !isNotEmptyString(process.env.OPENAI_ACCESS_TOKEN))
  throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

let ChatGptApi: ChatGPTAPI | ChatGPTUnofficialProxyAPI
let ChatGptApi16K: ChatGPTAPI | ChatGPTUnofficialProxyAPI
let ChatGptApi4: ChatGPTAPI | ChatGPTUnofficialProxyAPI

(async () => {
	function setModelTokens(model, options){
		// increase max token limit if use gpt-4
    if (model.toLowerCase().includes('gpt-4')) {
      // if use 32k model
      if (model.toLowerCase().includes('32k')) {
        options.maxModelTokens = 32768
        options.maxResponseTokens = 16384
      } else {
        options.maxModelTokens = 8192
        options.maxResponseTokens = 4096
      }
    }
    else {
			if (model.toLowerCase().includes('16k')) {
        options.maxModelTokens = 16384
        options.maxResponseTokens = 8192
      } else {
				options.maxModelTokens = 4096
				options.maxResponseTokens = 2048
			}
    }
	}

  // More Info: https://github.com/transitive-bullshit/chatgpt-api
	const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL
	if (isNotEmptyString(process.env.OPENAI_API_KEY2)) {
    const model2 = 'gpt-3.5-turbo-16k'

		const options2: ChatGPTAPIOptions = {
      apiKey: process.env.OPENAI_API_KEY2,
      completionParams: { model: model2 },
      debug: true,
    }
		setModelTokens(model2, options2)

		if (isNotEmptyString(OPENAI_API_BASE_URL))
      options2.apiBaseUrl = `${OPENAI_API_BASE_URL}/v1`

    setupProxy(options2)

    ChatGptApi16K = new ChatGPTAPI({ ...options2 })
	}

  if (isNotEmptyString(process.env.OPENAI_API_KEY)) {
		// gpt-3.5
    const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
    const model = isNotEmptyString(OPENAI_API_MODEL) ? OPENAI_API_MODEL : 'gpt-3.5-turbo'

		const options: ChatGPTAPIOptions = {
      apiKey: process.env.OPENAI_API_KEY,
      completionParams: { model },
      debug: true,
    }
		setModelTokens(model, options)

    if (isNotEmptyString(OPENAI_API_BASE_URL))
      options.apiBaseUrl = `${OPENAI_API_BASE_URL}/v1`

    setupProxy(options)

    ChatGptApi = new ChatGPTAPI({ ...options })

		// gpt-4
		const model4 = 'gpt-4'
		const options4: ChatGPTAPIOptions = {
      apiKey: process.env.OPENAI_API_KEY,
      completionParams: { model: model4 },
      debug: true,
    }

		setModelTokens(model4, options4)

    if (isNotEmptyString(OPENAI_API_BASE_URL))
			options4.apiBaseUrl = `${OPENAI_API_BASE_URL}/v1`

    setupProxy(options4)
		ChatGptApi4 = new ChatGPTAPI({ ...options4 })

    apiModel = 'ChatGPTAPI'
  }
  else {
    const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
    const options: ChatGPTUnofficialProxyAPIOptions = {
      accessToken: process.env.OPENAI_ACCESS_TOKEN,
      debug: true,
    }
    if (isNotEmptyString(OPENAI_API_MODEL))
      options.model = OPENAI_API_MODEL

    if (isNotEmptyString(process.env.API_REVERSE_PROXY))
      options.apiReverseProxyUrl = process.env.API_REVERSE_PROXY

    setupProxy(options)

    ChatGptApi = new ChatGPTUnofficialProxyAPI({ ...options })
    apiModel = 'ChatGPTUnofficialProxyAPI'
  }
})()

async function chatReplyProcess(options: RequestOptions, type = "") {
  let { message, lastContext, process: processFunction, systemMessage, temperature } = options
  try {
    let options: SendMessageOptions = { timeoutMs }

    if (apiModel === 'ChatGPTAPI') {
      if (isNotEmptyString(systemMessage))
        options.systemMessage = systemMessage
    }

    if (lastContext != null) {
      if (apiModel === 'ChatGPTAPI')
        options.parentMessageId = lastContext.parentMessageId
      else
        options = { ...lastContext }
    }

    options.completionParams = options.completionParams || {}
    if (!temperature)
      temperature = 0

    options.completionParams.temperature = temperature

		if (type == "ChatGPT16K" && ChatGptApi16K) {
			const response = await ChatGptApi16K.sendMessage(message, {
				...options,
				onProgress: (partialResponse) => {
					processFunction && processFunction(partialResponse)
				},
			})

			return sendResponse({ type: 'Success', data: response })
		} else if (type == "ChatGPT4" && ChatGptApi4) {
			const response = await ChatGptApi4.sendMessage(message, {
				...options,
				onProgress: (partialResponse) => {
					processFunction && processFunction(partialResponse)
				},
			})

			return sendResponse({ type: 'Success', data: response })
		}	else {
			const response = await ChatGptApi.sendMessage(message, {
				...options,
				onProgress: (partialResponse) => {
					processFunction && processFunction(partialResponse)
				},
			})

			return sendResponse({ type: 'Success', data: response })
		}
  }
  catch (error: any) {
    const code = error.statusCode
    global.console.log(error)
    if (Reflect.has(ErrorCodeMessage, code))
      return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] })
    return sendResponse({ type: 'Fail', message: error.message || 'Please check the back-end console' })
  }
}

async function fetchBalance() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

  if (!isNotEmptyString(OPENAI_API_KEY))
    return Promise.resolve('-')

  const API_BASE_URL = isNotEmptyString(OPENAI_API_BASE_URL)
    ? OPENAI_API_BASE_URL
    : 'https://api.openai.com'

  try {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` }
    const response = await axios.get(`${API_BASE_URL}/dashboard/billing/credit_grants`, { headers })
    const balance = response.data.total_available || 0
    return Promise.resolve(balance.toFixed(3))
  }
  catch {
    return Promise.resolve('-')
  }
}

async function chatConfig() {
  const balance = await fetchBalance()
  const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
  const reverseProxy = process.env.API_REVERSE_PROXY || '-'
  const httpsProxy = (process.env.HTTPS_PROXY || process.env.ALL_PROXY) || '-'
  const socksProxy = (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT)
    ? (`${process.env.SOCKS_PROXY_HOST}:${process.env.SOCKS_PROXY_PORT}`)
    : '-'
  return sendResponse<ModelConfig>({
    type: 'Success',
    data: { apiModel: isNotEmptyString(OPENAI_API_MODEL) ? OPENAI_API_MODEL : 'gpt-3.5-turbo', reverseProxy, timeoutMs, socksProxy, httpsProxy, balance },
  })
}

function setupProxy(options: ChatGPTAPIOptions | ChatGPTUnofficialProxyAPIOptions) {
  if (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT) {
    const agent = new SocksProxyAgent({
      hostname: process.env.SOCKS_PROXY_HOST,
      port: process.env.SOCKS_PROXY_PORT,
    })
    options.fetch = (url, options) => {
      return fetch(url, { agent, ...options })
    }
  }
  else {
    if (process.env.HTTPS_PROXY || process.env.ALL_PROXY) {
      const httpsProxy = process.env.HTTPS_PROXY || process.env.ALL_PROXY
      if (httpsProxy) {
        const agent = new HttpsProxyAgent(httpsProxy)
        options.fetch = (url, options) => {
          return fetch(url, { agent, ...options })
        }
      }
    }
  }
}

function currentModel(): ApiModel {
  return apiModel
}

export type { ChatContext, ChatMessage }

export { chatReplyProcess, chatConfig, currentModel }
