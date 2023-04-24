<script setup lang='ts'>
import { computed, ref } from 'vue'
import { NButton, NInput, NModal, useMessage } from 'naive-ui'
import { fetchVerify } from '@/api'
import { useAuthStore } from '@/store'
import Icon403 from '@/icons/403.vue'

interface Props {
  visible: boolean
}

defineProps<Props>()

const authStore = useAuthStore()

const ms = useMessage()

const loading = ref(false)
const token = ref('')
const username = ref('')
const telephone = ref('')

const disabled = computed(() => !token.value.trim() || loading.value)

async function handleVerify() {
  const tokenText = token.value.trim()
  const usernameText = username.value.trim()
  const telephoneText = telephone.value.trim()

  if (!tokenText || !usernameText || !telephoneText)
    return

  try {
    loading.value = true
    await fetchVerify({ token: tokenText, username: usernameText, telephone: telephoneText })
    authStore.setToken(tokenText, usernameText, telephoneText)
    ms.success('success')
    window.location.reload()
  }
  catch (error: any) {
    ms.error(error.message || 'error')
    authStore.removeToken()
    token.value = ''
    username.value = ''
    telephone.value = ''
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
  <NModal :show="visible" style="width: 90%; max-width: 640px">
    <div class="p-10 bg-white rounded dark:bg-slate-800">
      <div class="space-y-4">
        <header class="space-y-2">
          <h2 class="text-2xl font-bold text-center text-slate-800 dark:text-neutral-200">
            403
          </h2>
          <p class="text-base text-center text-slate-500 dark:text-slate-500">
            {{ $t('common.unauthorizedTips') }}
          </p>
          <Icon403 class="w-[200px] m-auto" />
        </header>
        <div>因发现访问路径外泄，导致访问量巨增，我比较担心成本问题，现实行密码验证访问，请联系我本人获取密码，获取密码后不要外泄。</div>
        <NInput v-model:value="token" type="password" placeholder="请输入密码" @keypress="handlePress" />
        <NInput v-model:value="username" type="text" placeholder="请输入姓名" @keypress="handlePress" />
        <NInput v-model:value="telephone" type="text" placeholder="请输入手机号" @keypress="handlePress" />
        <NButton
          block
          type="primary"
          :disabled="disabled"
          :loading="loading"
          @click="handleVerify"
        >
          {{ $t('common.verify') }}
        </NButton>
      </div>
    </div>
  </NModal>
</template>
