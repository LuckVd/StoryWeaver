import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      // @storyweaver/core 包含 Node.js 运行时代码（storage/llm/agents），
      // 浏览器端只通过 API 间接使用，不直接 bundle 这些代码。
      external: ['@storyweaver/core'],
    },
  },
});
