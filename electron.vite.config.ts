import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Electron 桌面应用构建配置。
// - main: 主进程,起 StoryWeaver 后端(loopback)+ 创建窗口。bundle 所有后端依赖
//   (core/hono/chokidar 等),仅 external electron(runtime 提供),使产物自包含。
// - preload: 同步向后端索要 loopback 端口,注入 window.__STORYWEAVER_API_BASE__。
// - renderer: 复用 studio 前端(react+tailwind),root 指向 packages/studio。
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/main.ts') },
        external: ['electron'],
      },
      outDir: 'out/main',
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/preload.ts') },
        external: ['electron'],
      },
      outDir: 'out/preload',
    },
  },
  renderer: {
    root: resolve(__dirname, 'packages/studio'),
    base: './',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'packages/studio/index.html'),
        external: ['@storyweaver/core'],
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': resolve(__dirname, 'packages/studio/src') },
    },
  },
});
