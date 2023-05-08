import path from 'path'
import type { PluginOption } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import compressionPlugin from 'vite-plugin-compression'
// import visualizer from 'rollup-plugin-visualizer';

function setupPlugins(env: ImportMetaEnv): PluginOption[] {
  return [
    vue(),
    env.VITE_GLOB_APP_PWA === 'true' && VitePWA({
      injectRegister: 'auto',
      manifest: {
        name: 'chatGPT',
        short_name: 'chatGPT',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
    // 使用 Gzip 压缩插件
    compressionPlugin({
      ext: '.gz', // 输出文件扩展名（默认为 .gz）
      algorithm: 'gzip', // 使用 Gzip 算法（默认为 'gzip'，也可以设置为 'brotliCompress' 使用 Brotli 算法）
      // 更多配置选项可参考：https://github.com/anncwb/vite-plugin-compression#readme
    }),
  ]
}

export default defineConfig((env) => {
  const viteEnv = loadEnv(env.mode, process.cwd()) as unknown as ImportMetaEnv

  return {
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    plugins: setupPlugins(viteEnv),
    server: {
      host: '0.0.0.0',
      port: 1002,
      open: false,
      proxy: {
        '/api': {
          target: viteEnv.VITE_APP_API_BASE_URL,
          changeOrigin: true, // 允许跨域
          rewrite: path => path.replace('/api/', '/'),
        },
      },
    },
    build: {
      reportCompressedSize: false,
      sourcemap: false,
      productionSourceMap: false,
      commonjsOptions: {
        ignoreTryCatch: false,
      },
      rollupOptions: {
        // plugins: [
        // 	// 使用 Visualizer 插件
        // 	visualizer({
        // 		open: true, // 构建完成后自动打开报告页面
        // 		gzipSize: true, // 显示 Gzip 压缩后的大小
        // 		filename: 'dist/stats.html', // 输出报告文件名
        // 	}),
        // ],
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // 根据模块名称或路径进行拆分，例如：
              if (id.includes('highlight'))
                return 'highlight'

              if (id.includes('naive-ui'))
                return 'naive-ui'

              if (id.includes('html2canvas'))
                return 'html2canvas'

              if (id.includes('katex'))
                return 'katex'

              if (id.includes('crypto-js'))
                return 'crypto-js'

              if (id.includes('@vue'))
                return 'vue'

              if (id.includes('markdown-it'))
                return 'markdown-it'

              if (id.includes('lodash-es'))
                return 'lodash-es'

              // 其他模块保留在 vendor chunk 中
              return 'vendor'
            }
          },
        },
      },
    },
  }
})
