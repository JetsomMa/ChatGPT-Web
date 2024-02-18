<script setup lang='ts'>
import { onMounted, ref } from 'vue'
import { fetchChatConfig } from '@/api'

// interface ConfigState {
//   timeoutMs?: number
//   reverseProxy?: string
//   apiModel?: string
//   socksProxy?: string
//   httpsProxy?: string
//   balance?: string
// }

// const authStore = useAuthStore()

// const loading = ref(false)

const balance = ref(0)

// const isChatGPTAPI = computed<boolean>(() => !!authStore.isChatGPTAPI)

async function fetchConfig() {
  const data: any = await fetchChatConfig()
  balance.value = data.balance || '-'
}

onMounted(() => {
  fetchConfig()
})
</script>

<template>
  <div style="padding: 10px 0px;">
    <div>可用余额：{{ balance }} 元(人民币)</div>
    <div style="color: green; font-size: 20px; padding-bottom: 10px;">
      请帮我推广传播
    </div>
    <ul style="font-size: 12px;">
      <!-- <ol>Claude、New Bing和矩阵运算功能免费</ol>
      <ol>chatgpt功能新注册用户可免费试用一个月</ol>
      <ol>chatgpt收费每月20元人民币，包年199元每年</ol>
      <ol>画画功能包月25元，单张图0.5元[所有用户每月可免费使用5次]</ol>
      <ol>过期用户每天可以免费chatgpt问答3次，画画1次[每月总共5次]</ol> -->
      <!-- <ol>网站将长期免费，有过充值的朋友可以找我退费</ol> -->

      <ol>求推广扩散，不需要梯子。</ol>
      <ol>新用户当天免费使用3.5模型5次</ol>
      <ol>老用户每天免费使用3.5模型2次</ol>
      <ol>联系网站管理获取使用权限【微信/电话：18514665919】</ol>
    </ul>
    <div style="font-size: 19px; padding: 10px 0px;">
      阅读<a href="https://blog.mashaojie.cn/9999/09/08/%E5%9B%BD%E5%86%85%E5%85%8D%E7%BF%BB%E7%9A%84ChatGPT%E5%92%8CMidjourney%E7%BD%91%E7%AB%99/" class="text-blue-500" target="_blank">网站使用指南</a>[更新于2023/05/30 13:15]
    </div>
    <div style="display: flex; height: 230px; justify-content: center;">
      <img src="https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg" alt="扫码加好友">
      <img src="https://download.mashaojie.cn/image/%E7%BE%A4%E4%BA%8C%E7%BB%B4%E7%A0%81.png" alt="扫码进群">
    </div>
  </div>
  <!-- <NSpin :show="loading">
    <div class="p-4 space-y-4">
      <h2 class="text-xl font-bold">
        Version - {{ pkg.version }}
      </h2>
      <div class="p-2 space-y-2 rounded-md bg-neutral-100 dark:bg-neutral-700">
        <p>
          此项目开源于
          <a
            class="text-blue-600 dark:text-blue-500"
            href="https://github.com/Chanzhaoyu/chatgpt-web"
            target="_blank"
          >
            Github
          </a>
          ，免费且基于 MIT 协议，没有任何形式的付费行为！
        </p>
        <p>
          如果你觉得此项目对你有帮助，请在 Github 帮我点个 Star 或者给予一点赞助，谢谢！
        </p>
      </div>
      <p>{{ $t("setting.api") }}：{{ (config || {}).apiModel || '-' }}</p>
      <p v-if="isChatGPTAPI">
        {{ $t("setting.balance") }}：{{ (config || {}).balance || '-' }}
      </p>
      <p v-if="!isChatGPTAPI">
        {{ $t("setting.reverseProxy") }}：{{ (config || {}).reverseProxy || '-' }}
      </p>
      <p>{{ $t("setting.timeout") }}：{{ (config || {}).timeoutMs || '-' }}</p>
      <p>{{ $t("setting.socks") }}：{{ (config || {}).socksProxy || '-' }}</p>
      <p>{{ $t("setting.httpsProxy") }}：{{ (config || {}).httpsProxy || '-' }}</p>
    </div>
  </NSpin> -->
</template>
