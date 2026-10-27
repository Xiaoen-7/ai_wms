import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 基础配置 - 移动端 H5，按 rem 适配
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: true
  },
  build: {
    target: 'es2015',
    cssCodeSplit: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router'],
          vant: ['vant']
        }
      }
    }
  }
})
