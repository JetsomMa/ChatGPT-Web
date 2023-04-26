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
const token = ref('true')
const username = ref('')
const telephone = ref('')
const remark = ref('')

const disabled = computed(() => !token.value.trim() || loading.value)

async function handleVerify() {
  const tokenText = token.value.trim()
  const usernameText = username.value.trim()
  const telephoneText = telephone.value.trim()
  const remarkText = remark.value.trim()

  if (!tokenText || !usernameText || !telephoneText)
    return

  try {
    loading.value = true
    await fetchVerify({ token: tokenText, username: usernameText, telephone: telephoneText, remark: remarkText })
    authStore.setToken(tokenText, usernameText, telephoneText)
    ms.success('success')
    window.location.reload()
  }
  catch (error: any) {
    ms.error(error.message || 'error')
    authStore.removeToken()
    // token.value = ''
    // username.value = ''
    // telephone.value = ''
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
        <div>请实名使用，6月1日起将进行收费。</div>
        <div>可以向外推广，我将对前50名用户实行终身免费。</div>
        <div>用户数量打到服务器压力，将不再支持新用户入驻。</div>
        <div>使用前，请先阅读左下角的使用指南。</div>
        <div>具体使用分以下三步：【存量用户可直接登录使用】</div>
        <div>1、输入真实姓名和手机号进行注册</div>
        <div>2、微信联系我，进行账号激活[wx:18514665919]</div>
        <div>3、再次输入真实姓名和手机号登陆</div>
        <!-- <NInput v-model:value="token" type="password" placeholder="请输入密码" @keypress="handlePress" /> -->
        <NInput v-model:value="username" type="text" placeholder="请输入姓名" @keypress="handlePress" />
        <NInput v-model:value="telephone" type="text" placeholder="请输入手机号" @keypress="handlePress" />
        <NInput v-model:value="remark" type="text" placeholder="【非必输】描述链接来源" @keypress="handlePress" />
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
