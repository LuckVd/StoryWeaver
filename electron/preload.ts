import { contextBridge, ipcRenderer } from 'electron';

// 同步向后端索要 loopback 基址(main 起好 server 后返回)。
// 在页面加载前执行,确保 api-client 首次 fetch 前 base 已就绪(无竞态)。
const apiBase = ipcRenderer.sendSync('storyweaver:get-api-base') as string;
contextBridge.exposeInMainWorld('__STORYWEAVER_API_BASE__', apiBase);

// 自定义标题栏窗口控制 + 界面缩放(frame:false 下前端经此 IPC 调主进程)
contextBridge.exposeInMainWorld('storyweaver', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:maximize-toggle'),
  close: () => ipcRenderer.invoke('window:close'),
  onMaximizedChange: (cb: (maximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_e, maximized: boolean) => cb(maximized));
  },
  getZoom: () => ipcRenderer.invoke('zoom:get'),
  setZoom: (value: number) => ipcRenderer.invoke('zoom:set', value),
});
