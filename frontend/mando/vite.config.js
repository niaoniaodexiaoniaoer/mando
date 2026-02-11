import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  // --- 新增以下构建配置 ---
  build: {
    // 1. 指定输出目录为后端的 dist 文件夹
    // 这里的 ../../ 是基于当前文件所在的 frontend/mando/ 目录向上跳两级进入根目录，再进入 backend/dist
    outDir: '../../backend/dist',
    
    // 2. 构建前自动清空目标目录，确保没有旧文件的残留
    emptyOutDir: true,
  }
})
