<script lang="ts" setup>
import { NButton } from 'naive-ui'
import { useRouter } from 'vue-router'
import Icon500 from '@/icons/500.vue'

const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="flex h-full dark:bg-neutral-800">
    <div class="px-4 m-auto space-y-4 text-center max-[400px]">
      <header class="space-y-2">
        <h2 class="text-2xl font-bold text-center text-slate-800 dark:text-neutral-200">
          520
        </h2>
        <p class="text-base text-center text-slate-500 dark:text-slate-500">
          服务异常，请联系管理员修复，微信：18514665919
        </p>
        <div style="width: 100%;display: flex;justify-content: center;">
          <img style="width: 200px; text-align: center;" src="https://download.mashaojie.cn/image/%E5%8A%A0%E6%88%91%E5%A5%BD%E5%8F%8B.jpg" alt="">
        </div>
        <div class="flex items-center justify-center text-center">
          <Icon500 class="w-[300px]" />
        </div>
      </header>
      <NButton type="primary" @click="goHome">
        Go to Home
      </NButton>
    </div>
  </div>
</template>
