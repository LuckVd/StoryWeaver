// Electron preload 注入(dev/vite 下无注入)
interface Window {
  // 后端 loopback 基址,前端走 /api 代理
  __STORYWEAVER_API_BASE__?: string;
  // 自定义标题栏窗口控制 + 界面缩放(frame:false)
  storyweaver?: {
    minimize: () => void;
    toggleMaximize: () => void;
    close: () => void;
    onMaximizedChange: (cb: (maximized: boolean) => void) => void;
    getZoom: () => Promise<number>;
    setZoom: (value: number) => Promise<number>;
  };
}
