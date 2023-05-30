<script lang="ts" setup>
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import mdKatex from '@traptitech/markdown-it-katex'
import mila from 'markdown-it-link-attributes'
import hljs from 'highlight.js'
import { useMessage } from 'naive-ui'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { t } from '@/locales'

interface Props {
  inversion?: boolean
  error?: boolean
  finish?: boolean
  text?: string
  querymethod?: string
  loading?: boolean
  asRawText?: boolean
}

interface Emit {
  (ev: 'regenerate'): void
  (ev: 'variationImage', data: string): void
  (ev: 'upscaleImage', data: string): void
}

const props = defineProps<Props>()

const emit = defineEmits<Emit>()

const { isMobile } = useBasicLayout()

const textRef = ref<HTMLElement>()

const ms = useMessage()

const mdi = new MarkdownIt({
  linkify: true,
  highlight(code, language) {
    const validLang = !!(language && hljs.getLanguage(language))
    if (validLang) {
      const lang = language || ''
      return highlightBlock(hljs.highlight(code, { language: lang }).value, lang)
    }
    return highlightBlock(hljs.highlightAuto(code).value, '')
  },
})

mdi.use(mila, { attrs: { target: '_blank', rel: 'noopener' } })
mdi.use(mdKatex, { blockClass: 'katexmath-block rounded-md p-[10px]', errorColor: ' #cc0000' })

const wrapClass = computed(() => {
  return [
    'text-wrap',
    'min-w-[20px]',
    'rounded-md',
    isMobile.value ? 'p-2' : 'px-3 py-2',
    props.inversion ? 'bg-[#d2f9d1]' : 'bg-[#f4f6f8]',
    props.inversion ? 'dark:bg-[#a1dc95]' : 'dark:bg-[#1e1e20]',
    props.inversion ? 'message-request' : 'message-reply',
    { 'text-red-500': props.error },
  ]
})

let orgText = props.text || ''
const text = computed(() => {
  orgText = props.text || ''
  const value = props.text || ''
  if (!props.asRawText)
    return mdi.render(value)
  return value
})

function highlightBlock(str: string, lang?: string) {
  return `<pre class="code-block-wrapper"><div class="code-block-header"><span class="code-block-header__lang">${lang}</span><span class="code-block-header__copy">${t('chat.copyCode')}</span></div><code class="hljs code-block-body ${lang}">${str}</code></pre>`
}

defineExpose({ textRef })

function handleRegenerate() {
  emit('regenerate')
}

function getImageUrl() {
  const regex = /!\[(?:imagine|variation|upscale)\]\((.*?)\)/
  const match = orgText.match(regex)
  if (match)
    return match[1]

  return ''
}

function download() {
  const url = getImageUrl()
  if (url) {
    const link = document.createElement('a')
    link.download = `chat_mashaojie_cn_${new Date().getTime()}.png`
    link.href = url
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  else {
    ms.error('没有图片可以下载哦~')
  }
}

function variationImage(index: number) {
  const url = getImageUrl()
  emit('variationImage', `variation,${url},${index}`)
}

function upscaleImage(index: number) {
  const url = getImageUrl()
  emit('upscaleImage', `upscale,${url},${index}`)
}
</script>

<template>
  <div class="text-black" :class="wrapClass">
    <template v-if="loading">
      <span class="dark:text-white w-[4px] h-[20px] block animate-blink" />
    </template>
    <template v-else>
      <div ref="textRef" class="leading-relaxed break-words">
        <div v-if="!inversion">
          <div v-if="!asRawText" class="markdown-body" v-html="text" />
          <div v-else class="whitespace-pre-wrap" v-text="text" />
        </div>
        <div v-else class="whitespace-pre-wrap" v-text="text" />
        <div v-if="!inversion && finish">
          <div class="button-row">
            <button v-if="orgText.startsWith('![imagine](') || orgText.startsWith('![variation](')" class="button small-button" @click="variationImage(1)">
              V1
            </button>
            <button v-if="orgText.startsWith('![imagine](') || orgText.startsWith('![variation](')" class="button small-button" @click="variationImage(2)">
              V2
            </button>
            <button v-if="orgText.startsWith('![imagine](') || orgText.startsWith('![variation](')" class="button small-button" @click="variationImage(3)">
              V3
            </button>
            <button v-if="orgText.startsWith('![imagine](') || orgText.startsWith('![variation](')" class="button small-button" @click="variationImage(4)">
              V4
            </button>
          </div>
          <div class="button-row">
            <button v-if="orgText.startsWith('![imagine](') || orgText.startsWith('![variation](')" class="button small-button" @click="upscaleImage(1)">
              U1
            </button>
            <button v-if="orgText.startsWith('![imagine](') || orgText.startsWith('![variation](')" class="button small-button" @click="upscaleImage(2)">
              U2
            </button>
            <button v-if="orgText.startsWith('![imagine](') || orgText.startsWith('![variation](')" class="button small-button" @click="upscaleImage(3)">
              U3
            </button>
            <button v-if="orgText.startsWith('![imagine](') || orgText.startsWith('![variation](')" class="button small-button" @click="upscaleImage(4)">
              U4
            </button>
          </div>
          <div class="button-row">
            <button v-if="!asRawText && querymethod === '画画' && (orgText.startsWith('![imagine](') || orgText.startsWith('![variation](') || orgText.startsWith('![upscale]('))" class="button" @click="download">
              下载图片
            </button>
            <button class="button" @click="handleRegenerate">
              重新生成
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="less">
@import url(./style.less);
.button-row {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .button {
    padding: 0px 5px;
    font-size: 14px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    margin: 10px 10px 0px 10px;
  }
	.small-button {
		width: 60px;
	}
  .button:last-child {
    margin-right: 0;
  }
</style>
