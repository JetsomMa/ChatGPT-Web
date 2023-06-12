<script setup lang='ts'>
import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { NAutoComplete, NButton, NCard, NImage, NInput, NModal, NRadioButton, NRadioGroup, NUpload, useDialog, useMessage } from 'naive-ui'
import html2canvas from 'html2canvas'
import { Message } from './components'
import HeaderComponent from './components/Header/index.vue'
import { querymethodsOptions } from './components/Header/options'
import { useScroll } from './hooks/useScroll'
import { useChat } from './hooks/useChat'
import { useCopyCode } from './hooks/useCopyCode'
import { useQueryMethod } from './hooks/useQueryMethod'
import { HoverButton, SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useChatStore, usePromptStore } from '@/store'
import { addImageFile as addImageFileFunc, fetchChatAPIProcess, getImageList as getImageListFunc } from '@/api'
import { t } from '@/locales'

let controller = new AbortController()

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'
const route = useRoute()
const dialog = useDialog()
const ms = useMessage()

const chatStore = useChatStore()
const { querymethod, setQueryMethod } = useQueryMethod()

useCopyCode()

const { isMobile } = useBasicLayout()
const { addChat, updateChat, updateChatSome, getChatByUuidAndIndex } = useChat()
const { scrollRef, scrollToBottom, scrollToBottomIfAtBottom } = useScroll()

const { uuid } = route.params as { uuid: string }

const dataSources = computed(() => chatStore.getChatByUuid(+uuid))
const conversationList = computed(() => dataSources.value.filter(item => (!item.inversion && !item.error)))

const querymethods = ref(querymethodsOptions)

const prompt = ref<string>('')
const loading = ref<boolean>(false)
const notionShow = ref<boolean>(true)
const inputRef = ref<Ref | null>(null)
const visiablePicturePanel = ref<boolean>(false)
const state = reactive({
  images: [],
})

// 添加PromptStore
const promptStore = usePromptStore()

// 使用storeToRefs，保证store修改后，联想部分能够重新渲染
const { promptList: promptTemplate } = storeToRefs<any>(promptStore)

// 未知原因刷新页面，loading 状态不会重置，手动重置
dataSources.value.forEach((item, index) => {
  if (item.loading)
    updateChatSome(+uuid, index, { loading: false })
})

function handleSubmit() {
  onConversation()
}

async function onConversation() {
  let message = prompt.value

  if (loading.value)
    return

  if (!message || message.trim() === '')
    return

  if (message.length > 1200) {
    ms.error('输入字符超长，不能超过1200个字符！')
    return
  }

  controller = new AbortController()

  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: message,
      inversion: true,
      error: false,
      querymethod: querymethod.value,
      conversationOptions: null,
      requestOptions: { prompt: message, options: null },
    },
  )
  scrollToBottom()

  loading.value = true
  prompt.value = ''

  let options: Chat.ConversationRequest = {}
  const lastContext = (conversationList.value[conversationList.value.length - 1] || {}).conversationOptions

  if (lastContext && (querymethod.value === 'ChatGPT'))
    options = { ...lastContext }

  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      loading: true,
      finish: false,
      inversion: false,
      error: false,
      querymethod: querymethod.value,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )
  scrollToBottom()

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: message,
        querymethod: querymethod.value,
        options,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
          let chunk = responseText
          if (lastIndex !== -1)
            chunk = responseText.substring(lastIndex)
          try {
            const data = JSON.parse(chunk)
            updateChat(
              +uuid,
              dataSources.value.length - 1,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + data.text || '',
                querymethod: querymethod.value,
                inversion: false,
                error: false,
                loading: false,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
              },
            )

            if (openLongReply) {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }

            if (data.finish) {
              updateChatSome(
                +uuid,
                dataSources.value.length - 1,
                {
                  dateTime: new Date().toLocaleString(),
                  finish: true,
                },
              )
            }

            scrollToBottomIfAtBottom()
          }
          catch (error) {
          //
          }
        },
      })
    }

    await fetchChatAPIOnce()
  }
  catch (error: any) {
    const errorMessage = (error || {}).message || t('common.wrong')

    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        dataSources.value.length - 1,
        {
          loading: false,
        },
      )
      scrollToBottomIfAtBottom()
      return
    }

    const currentChat = getChatByUuidAndIndex(+uuid, dataSources.value.length - 1)

    if (currentChat && currentChat.text && currentChat.text !== '') {
      updateChatSome(
        +uuid,
        dataSources.value.length - 1,
        {
          text: `${currentChat.text}\n[${errorMessage}]`,
          error: false,
          loading: false,
        },
      )
      return
    }

    updateChat(
      +uuid,
      dataSources.value.length - 1,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        querymethod: querymethod.value,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
    scrollToBottomIfAtBottom()
  }
  finally {
    loading.value = false
  }
}

async function onRegenerate(index: number) {
  if (loading.value)
    return

  controller = new AbortController()

  const { requestOptions } = dataSources.value[index]

  let message = (requestOptions || {}).prompt || ''

  let options: Chat.ConversationRequest = {}

  if (requestOptions.options)
    options = { ...requestOptions.options }

  loading.value = true

  updateChat(
    +uuid,
    index,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      inversion: false,
      finish: false,
      error: false,
      loading: true,
      querymethod: querymethod.value,
      conversationOptions: null,
      requestOptions: { prompt: message, ...options },
    },
  )

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: message,
        querymethod: querymethod.value,
        options,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
          let chunk = responseText
          if (lastIndex !== -1)
            chunk = responseText.substring(lastIndex)
          try {
            const data = JSON.parse(chunk)
            updateChat(
              +uuid,
              index,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + data.text || '',
                inversion: false,
                finish: false,
                error: false,
                loading: false,
                querymethod: querymethod.value,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, ...options },
              },
            )

            if (openLongReply) {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }

            if (data.finish) {
              updateChatSome(
                +uuid,
                index,
                {
                  dateTime: new Date().toLocaleString(),
                  finish: true,
                },
              )
            }
          }
          catch (error) {
            //
          }
        },
      })
    }
    await fetchChatAPIOnce()
  }
  catch (error: any) {
    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        index,
        {
          loading: false,
        },
      )
      return
    }

    const errorMessage = (error || {}).message || t('common.wrong')

    updateChat(
      +uuid,
      index,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        querymethod: querymethod.value,
        conversationOptions: null,
        requestOptions: { prompt: message, ...options },
      },
    )
  }
  finally {
    loading.value = false
  }
}

function handleExport() {
  if (loading.value)
    return

  const d = dialog.warning({
    title: t('chat.exportImage'),
    content: t('chat.exportImageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: async () => {
      try {
        d.loading = true
        const ele = document.getElementById('image-wrapper')
        const canvas = await html2canvas(ele as HTMLDivElement, {
          useCORS: true,
        })
        const imgUrl = canvas.toDataURL('image/png')
        const tempLink = document.createElement('a')
        tempLink.style.display = 'none'
        tempLink.href = imgUrl
        tempLink.setAttribute('download', 'chat-shot.png')
        if (typeof tempLink.download === 'undefined')
          tempLink.setAttribute('target', '_blank')

        document.body.appendChild(tempLink)
        tempLink.click()
        document.body.removeChild(tempLink)
        window.URL.revokeObjectURL(imgUrl)
        d.loading = false
        ms.success(t('chat.exportSuccess'))
        Promise.resolve()
      }
      catch (error: any) {
        ms.error(t('chat.exportFailed'))
      }
      finally {
        d.loading = false
      }
    },
  })
}

function handleDelete(index: number) {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.deleteMessage'),
    content: t('chat.deleteMessageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.deleteChatByUuid(+uuid, index)
    },
  })
}

function handleClear() {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.clearChat'),
    content: t('chat.clearChatConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.clearChatByUuid(+uuid)
    },
  })
}

function handleEnter(event: KeyboardEvent) {
  if (!isMobile.value) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
  else {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
}

function handleStop() {
  if (loading.value) {
    controller.abort()
    loading.value = false
  }
}

// 可优化部分
// 搜索选项计算，这里使用value作为索引项，所以当出现重复value时渲染异常(多项同时出现选中效果)
// 理想状态下其实应该是key作为索引项,但官方的renderOption会出现问题，所以就需要value反renderLabel实现
const searchOptions = computed(() => {
  if (prompt.value.startsWith('/')) {
    return promptTemplate.value.filter((item: { key: string }) => item.key.toLowerCase().includes(prompt.value.substring(1).toLowerCase())).map((obj: { value: any }) => {
      return {
        label: obj.value,
        value: obj.value,
      }
    })
  }
  else {
    return []
  }
})

// value反渲染key
const renderOption = (option: { label: string }) => {
  for (const i of promptTemplate.value) {
    if (i.value === option.label)
      return [i.key]
  }
  return []
}

const placeholder = computed(() => {
  if (isMobile.value)
    return t('chat.placeholderMobile')
  return t('chat.placeholder')
})

const buttonDisabled = computed(() => {
  return loading.value || !prompt.value || prompt.value.trim() === ''
})

const footerClass = computed(() => {
  let classes = ['p-4']
  if (isMobile.value)
    classes = ['sticky', 'left-0', 'bottom-0', 'right-0', 'p-2', 'pr-3', 'overflow-hidden']
  return classes
})

onMounted(() => {
  scrollToBottom()
  if (inputRef.value && !isMobile.value)
    inputRef.value.focus()

  // 开始语音识别插件注册
  document.dispatchEvent(new CustomEvent('init-speech-ball'))
  // 当语音识别确认时候触发事件
  document.addEventListener('speech-comfirm', (e: any) => {
    prompt.value = e.detail.result
    handleSubmit()
  })
  getImageList()
})

function handleVariationImage(data: string) {
  prompt.value = data
  handleSubmit()
}

function handleUpscaleImage(data: string) {
  prompt.value = data
  handleSubmit()
}

function visiablePicturePanelFunc() {
  visiablePicturePanel.value = true
}

onUnmounted(() => {
  if (loading.value)
    controller.abort()
})

const uploadFile = ref<boolean>(true)
async function handleFinish({ event }: { event: any }) {
  await addImageFile(`https://chat.mashaojie.cn/download/images/users/${event.srcElement.responseText}`)
  uploadFile.value = false
  setTimeout(() => {
    uploadFile.value = true
  }, 50)
}

function handleError(err: Error) {
  console.error(err)
  ms.error('文件上传失败！')
}

async function addImageFile(filename: string) {
  const response: any = await addImageFileFunc({ filename })
  if (response.status === 'Success') {
    getImageList()
    ms.success('文件上传成功！')
  }
  else {
    ms.error(response.message)
  }
}

async function getImageList() {
  const response: any = await getImageListFunc()
  if (response.status === 'Success') {
    state.images = JSON.parse(response.message).map((item: any) => {
      return item.filename
    })
  }
  else {
    ms.error(response.message)
  }
}

const createPromptVisibale = ref<boolean>(false)
const imageSelected = ref('')
const imagePrompt = ref('')
function imageClick(url: string) {
  imageSelected.value = url
  createPromptVisibale.value = true
}
function createImagePrompt() {
  prompt.value = `${imageSelected.value} ${imagePrompt.value}`
  imageSelected.value = ''
  imagePrompt.value = ''
  createPromptVisibale.value = false
  visiablePicturePanel.value = false
  handleSubmit()
}
</script>

<template>
  <div class="flex flex-col w-full h-full chat-index">
    <HeaderComponent
      v-if="isMobile"
      :querymethod="querymethod"
      @export="handleExport"
      @querymethodChange="setQueryMethod"
    />
    <main class="flex-1 overflow-hidden">
      <div style="width: 100%; display: flex; z-index: 100; align-items: center; flex-direction: column; position: absolute;">
        <!-- <div v-if="notionShow" style="position: relative; padding: 5px; color: green; width: 100%; background-color: yellow; opacity: 1;">
          <div style="padding-right: 45px;">
            请帮我推广传播，浏览器功能和矩阵运算功能免费，画画功能独立计费25元包月，单张图0.5元[所有用户每月可免费使用5次]，chatgpt功能新注册用户可免费试用一个月，后将收费每月20元人民币。过期用户每天可以免费chatgpt问答3次，每天免费画画1次[每月总共限制5次]。使用中有任何问题随时可以联系我，【微信/电话：18514665919】。
            <a href="https://blog.mashaojie.cn/9999/09/08/ChatGPT%E4%BD%BF%E7%94%A8%E6%8C%87%E5%8D%97" class="text-blue-500" target="_blank">阅读网站使用指南[更新于2023/05/30 13:15]</a>
          </div>
          <NButton type="primary" style="padding: 0 5px; position: absolute; right: 10px; top: 5px;" @click="notionShow = false">
            关闭
          </NButton>
        </div> -->
        <div v-if="!isMobile" style="padding: 10px; background-color: #efefef;">
          <NRadioGroup :value="querymethod" size="medium" default-value="ChatGPT" @update:value="setQueryMethod">
            <NRadioButton
              v-for="method of querymethods"
              :key="method.value"
              style="width: 150px; text-align: center;"
              :value="method.value"
              :disabled="method.disabled"
            >
              {{ method.label }}
            </NRadioButton>
          </NRadioGroup>
        </div>
      </div>
      <div
        id="scrollRef"
        ref="scrollRef"
        class="h-full overflow-hidden overflow-y-auto"
      >
        <div
          id="image-wrapper"
          class="w-full max-w-screen-xl m-auto dark:bg-[#101014]"
          :class="[isMobile ? 'p-2' : 'p-4']"
        >
          <template v-if="!dataSources.length">
            <div class="flex items-center justify-center mt-4 text-center text-neutral-300">
              <SvgIcon icon="ri:bubble-chart-fill" class="mr-2 text-3xl" />
              <span>Aha~</span>
            </div>
          </template>
          <template v-else>
            <Message
              v-for="(item, index) of dataSources"
              :key="index"
              :date-time="item.dateTime"
              :text="item.text"
              :inversion="item.inversion"
              :finish="item.finish"
              :querymethod="item.querymethod"
              :error="item.error"
              :loading="item.loading"
              @regenerate="onRegenerate(index)"
              @delete="handleDelete(index)"
              @variation-image="handleVariationImage"
              @upscale-image="handleUpscaleImage"
            />
            <div class="sticky bottom-0 left-0 flex justify-center">
              <NButton v-if="loading" type="warning" @click="handleStop">
                <template #icon>
                  <SvgIcon icon="ri:stop-circle-line" />
                </template>
                Stop Responding
              </NButton>
            </div>
          </template>
        </div>
      </div>
    </main>
    <footer :class="footerClass">
      <div class="w-full max-w-screen-xl m-auto">
        <div class="flex items-center justify-between space-x-2">
          <HoverButton @click="handleClear">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:delete-bin-line" />
            </span>
          </HoverButton>
          <HoverButton v-if="!isMobile" @click="handleExport">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:download-2-line" />
            </span>
          </HoverButton>
          <NButton v-if="querymethod === '画画'" type="primary" @click="visiablePicturePanelFunc">
            <template #icon>
              <span class="text-xl text-[#4f555e] dark:text-white" style="width: 22px; color: white;">
                <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024"><path d="M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zm-40 632H136v-39.9l138.5-164.3l150.1 178L658.1 489L888 761.6V792zm0-129.8L664.2 396.8c-3.2-3.8-9-3.8-12.2 0L424.6 666.4l-144-170.7c-3.2-3.8-9-3.8-12.2 0L136 652.7V232h752v430.2zM304 456a88 88 0 1 0 0-176a88 88 0 0 0 0 176zm0-116c15.5 0 28 12.5 28 28s-12.5 28-28 28s-28-12.5-28-28s12.5-28 28-28z" fill="currentColor" /></svg>
              </span>
            </template>
          </NButton>
          <!-- <HoverButton v-if="querymethod === '画画'" @click="visiablePicturePanelFunc" style="margin: 0;">
            <span class="text-xl text-[#4f555e] dark:text-white" style="width: 22px;">
              <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1024 1024"><path d="M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zm-40 632H136v-39.9l138.5-164.3l150.1 178L658.1 489L888 761.6V792zm0-129.8L664.2 396.8c-3.2-3.8-9-3.8-12.2 0L424.6 666.4l-144-170.7c-3.2-3.8-9-3.8-12.2 0L136 652.7V232h752v430.2zM304 456a88 88 0 1 0 0-176a88 88 0 0 0 0 176zm0-116c15.5 0 28 12.5 28 28s-12.5 28-28 28s-28-12.5-28-28s12.5-28 28-28z" fill="currentColor"></path></svg>
            </span>
          </HoverButton> -->
          <!-- <HoverButton v-if="!isMobile" @click="toggleUsingContext">
            <span class="text-xl" :class="{ 'text-[#4b9e5f]': usingContext, 'text-[#a8071a]': !usingContext }">
              <SvgIcon icon="ri:chat-history-line" />
            </span>
          </HoverButton> -->
          <NAutoComplete v-model:value="prompt" :options="searchOptions" :render-label="renderOption">
            <template #default="{ handleInput, handleBlur, handleFocus }">
              <NInput
                ref="inputRef"
                v-model:value="prompt"
                type="textarea"
                :placeholder="placeholder"
                :autosize="{ minRows: 1, maxRows: isMobile ? 4 : 8 }"
                @input="handleInput"
                @focus="handleFocus"
                @blur="handleBlur"
                @keypress="handleEnter"
              />
            </template>
          </NAutoComplete>
          <NButton type="primary" :disabled="buttonDisabled" @click="handleSubmit">
            <template #icon>
              <span class="dark:text-black">
                <SvgIcon icon="ri:send-plane-fill" />
              </span>
            </template>
          </NButton>
        </div>
      </div>
    </footer>
    <!-- 文件管理 -->
    <NModal v-model:show="visiablePicturePanel" class="file-manager">
      <NCard
        :style="isMobile ? 'width: 95%;' : 'width: 600px;'"
        style="padding: 10px; text-align: left;"
        :title="createPromptVisibale ? '照片衍生' : '上传照片管理'"
        :bordered="false"
        size="huge"
        role="dialog"
        aria-modal="true"
        :closable="true"
        @close="visiablePicturePanel = false, createPromptVisibale = false"
      >
        <div v-show="createPromptVisibale" style="padding: 10px; text-align: center;">
          <NImage :src="imageSelected" style="width: 120px; margin: 5px;" />
          <NInput v-model:value="imagePrompt" type="textarea" />
          <NButton type="primary" :disabled="!imagePrompt.length" style="margin-top: 10px;" @click="createImagePrompt">
            开始生成
          </NButton>
        </div>
        <div v-show="!createPromptVisibale" style="text-align: center;">
          <NUpload
            v-if="uploadFile"
            action="https://api.mashaojie.cn/python/api/upload"
            accept="image/png, image/jpeg, image/jpg"
            :max="1"
            @finish="handleFinish"
            @error="handleError"
          >
            <NButton type="primary">
              上传 PNG 文件
            </NButton>
          </NUpload>
          <NImage v-for="image of state.images" :key="image" :src="image" style="width: 120px; margin: 5px;" :preview-disabled="true" @click="imageClick(image)" />
        </div>
      </NCard>
    </NModal>
  </div>
</template>

<style>
.chat-index .n-radio-group .n-radio-button {
	background-color: violet;
	color: #666;
}
.chat-index .n-radio-group .n-radio-button.n-radio-button--checked {
	background: blue;
	color: #ffffff;
}
.chat-index .n-base-selection .n-base-selection-label {
	background-color: fuchsia !important;
}
.chat-index .n-base-selection .n-base-selection-label .n-base-selection-input {
	color: #ffffff;
}
.chat-index .n-base-selection .n-base-suffix .n-base-suffix__arrow {
	color: #ffffff;
}
.file-manager .n-card-header {
	padding: 0px 10px 10px !important;
}
.file-manager .n-card__content{
	padding: 0px !important;
}
</style>
