<script setup lang='ts'>
import { computed, ref } from 'vue'
import { NButton, NInput, NInputGroup, NModal, NTabPane, NTabs, useMessage } from 'naive-ui'
import { fetchPhoneCode, fetchVerify } from '@/api'
import { useAuthStore } from '@/store'

interface Props {
  visible: boolean
}

defineProps<Props>()

const authStore = useAuthStore()

const ms = useMessage()

const loading = ref(false)
const token = ref('true')
const password = ref('')
const username = ref('')
const telephone = ref('')
const phonecode = ref('')
const remark = ref('')
const loginmethod = ref('password')

const disabled = computed(() => !token.value.trim() || loading.value)
const disabledPhoneCode = ref(true)
const timer = ref(0)
async function getPhoneCode() {
  const telephoneText = telephone.value.trim()
  if (!telephoneText)
    return

  try {
    disabledPhoneCode.value = true
    timer.value = 120
    const myInterval = setInterval(() => {
      timer.value--
      if (timer.value <= 0) {
        clearInterval(myInterval)
        disabledPhoneCode.value = false
      }
      else {
        disabledPhoneCode.value = true
      }
    }, 1000)

    await fetchPhoneCode({ telephone: telephoneText })
    ms.success('success')
  }
  catch (error: any) {
    ms.error(error.message || 'error')
  }
}

function telephoneChage() {
  const telephoneText = telephone.value.trim()

  if (telephoneText.length === 11)
    disabledPhoneCode.value = false
  else
    disabledPhoneCode.value = true
}

async function handleVerify() {
  const tokenText = token.value.trim()
  const usernameText = username.value.trim()
  const telephoneText = telephone.value.trim()
  const remarkText = remark.value.trim()
  const phonecodeText = phonecode.value.trim()
  const passwordText = password.value.trim()

  if (loginmethod.value === 'password' && (!telephoneText || !passwordText))
    return

  if (loginmethod.value === 'phonecode' && (!telephoneText || !phonecodeText))
    return

  if (loginmethod.value === 'register' && (!usernameText || !telephoneText || !phonecodeText || !passwordText))
    return

  try {
    loading.value = true
    const response: any = await fetchVerify({ token: tokenText, username: usernameText, telephone: telephoneText, remark: remarkText, phonecode: phonecodeText, password: passwordText, loginmethod: loginmethod.value })
    authStore.setToken(tokenText, response.data.username, telephoneText)
    ms.success('success')
  }
  catch (error: any) {
    ms.error(error.message || 'error')
    authStore.removeToken()
  }
  finally {
    loading.value = false
  }
}

function handlePress(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleVerify()
  }
}
</script>

<template>
  <NModal :show="visible" style="width: 94%; max-width: 650px; padding: 10px 30px;">
    <div class="p-10 bg-white rounded dark:bg-slate-800">
      <div style="font-size: 20px; font-weight: 600; text-align: center; color: blueviolet;">
        只做好用的AI(chatgpt+画画)
      </div>
      <div class="space-y-4">
        <!-- <header class="space-y-2">
          <h2 class="text-2xl font-bold text-center text-slate-800 dark:text-neutral-200">
            403
          </h2>
          <p class="text-base text-center text-slate-500 dark:text-slate-500">
            {{ $t('common.unauthorizedTips') }}
          </p>
          <Icon403 class="w-[200px] m-auto" />
        </header> -->
        <div style="display: flex; width: 100%; height: 180px; justify-content: center;">
          <img style="height: 180px;" src="https://chat.mashaojie.cn/download/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg" alt="扫码加好友">
          <img style="height: 180px;" src="https://download.mashaojie.cn/image/%E7%BE%A4%E4%BA%8C%E7%BB%B4%E7%A0%81.png" alt="扫码进群">
        </div>
        <div style="text-align: center; font-size: 12px;">
          <!-- <div>输入用户名、手机号和验证码即可注册和登录。</div> -->
          <div>求推广扩散，不需要梯子。</div>
          <!-- <div>添加书签或手机“添加到主屏幕”，方便实用。</div> -->
          <!-- <div>openai接口有成本，6月10日起收费¥20/月。</div> -->
          <div>加我微信或进群，提供服务保障和技术分享。</div>
          <div>使用前，请先阅读<a href="https://blog.mashaojie.cn/9999/09/08/%E5%9B%BD%E5%86%85%E5%85%8D%E7%BF%BB%E7%9A%84ChatGPT%E5%92%8CMidjourney%E7%BD%91%E7%AB%99/" class="text-blue-500" target="_blank">ChatGPT使用指南</a></div>
        </div>

        <NTabs v-model:value="loginmethod" type="segment">
          <NTabPane name="password" tab="密码登录">
            <NInput v-model:value="telephone" type="text" placeholder="请输入手机号" @input="telephoneChage" @keypress="handlePress" />
            <NInput v-model:value="password" type="password" placeholder="请输入密码" @keypress="handlePress" />
            <NButton
              block
              type="primary"
              :disabled="disabled"
              :loading="loading"
              @click="handleVerify"
            >
              登陆
            </NButton>
          </NTabPane>
          <NTabPane name="phonecode" tab="验证码登录">
            <NInputGroup>
              <NInput v-model:value="telephone" type="text" placeholder="请输入手机号" :style="{ width: '70%' }" @input="telephoneChage" @keypress="handlePress" />
              <NButton
                :style="{ width: '40%' }"
                block
                type="primary"
                :disabled="disabledPhoneCode"
                @click="getPhoneCode"
              >
                获取验证码{{ timer ? `(${timer})` : '' }}
              </NButton>
            </NInputGroup>
            <NInput v-model:value="phonecode" type="text" placeholder="手机验证码" @keypress="handlePress" />
            <NButton
              block
              type="primary"
              :disabled="disabled"
              :loading="loading"
              @click="handleVerify"
            >
              登陆
            </NButton>
          </NTabPane>
          <NTabPane name="register" tab="注册">
            <NInput v-model:value="username" type="text" placeholder="请输入用户名" @keypress="handlePress" />
            <NInputGroup>
              <NInput v-model:value="telephone" type="text" placeholder="请输入手机号" :style="{ width: '70%' }" @input="telephoneChage" @keypress="handlePress" />
              <NButton
                :style="{ width: '40%' }"
                block
                type="primary"
                :disabled="disabledPhoneCode"
                @click="getPhoneCode"
              >
                获取验证码{{ timer ? `(${timer})` : '' }}
              </NButton>
            </NInputGroup>
            <NInput v-model:value="phonecode" type="text" placeholder="手机验证码" @keypress="handlePress" />
            <NInput v-model:value="password" type="password" placeholder="请输入密码" @keypress="handlePress" />
            <NInput v-model:value="remark" type="text" placeholder="【非必输】描述链接来源" @keypress="handlePress" />
            <NButton
              block
              type="primary"
              :disabled="disabled"
              :loading="loading"
              @click="handleVerify"
            >
              注册并登陆
            </NButton>
          </NTabPane>
        </NTabs>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.n-input,.n-button {
 	margin: 5px 0;
}
</style>
