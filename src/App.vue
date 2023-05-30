<script setup lang="ts">
import { onMounted } from 'vue'
import { NConfigProvider } from 'naive-ui'
import { NaiveProvider } from '@/components/common'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/hooks/useLanguage'

const { theme, themeOverrides } = useTheme()
const { language } = useLanguage()

onMounted(() => {
  // setTimeout(() => {
  //   alert('【请帮我推广传播，我会在我能力范围内让大家长期免费使用，谢谢您了！】这个网站由我一个人在进行开发和维护，如果遇到bug请谅解，并希望您能与我取得联系，以便于进行bug修复，我会尽我所能的为您提供优质且稳定的服务【微信：18514665919】')
  // }, 2000)

  // setTimeout(() => {
  //   	alert(`貌似网站的API接口链路被墙，紧急切换至“http://118.195.236.91:3002/”继续使用，我叫继续努力解决域名问题！`)
  // }, 2000)

  //   setTimeout(() => {
  //   	alert(`【巨力推广】欢迎来到我们的chatgpt网站！我们提供高质量的学习资源和知识分享平台，帮助您更好地掌握各种知识和技能。

  // 从6月1日起，我们将正式收取每月20元的会员费用。前50名用户可以长期免费使用我们的服务！这是一个难得的机会，不要错过！

  // 您可以获得的服务：
  // - 支持多端同一账号登录
  // - 访问3.5版本的chatgpt服务
  // - 访问我们的学习资源和知识分享文章
  // - 获得我们专业的支持和指导，解决您在使用中遇到的问题

// 我们致力于为您提供最好的学习体验和服务。加入我们的会员，开始您的学习之旅吧！`)
//   }, 2000)
})
</script>

<template>
  <NConfigProvider
    class="h-full"
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="language"
  >
    <NaiveProvider>
      <RouterView />
    </NaiveProvider>
  </NConfigProvider>
</template>
