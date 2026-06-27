// Electron preload 注入的后端 loopback 基址(dev/vite 下无注入,前端走 /api 代理)
interface Window {
  __STORYWEAVER_API_BASE__?: string;
}
