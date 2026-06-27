import { contextBridge, ipcRenderer } from 'electron';

// 同步向后端索要 loopback 基址(main 起好 server 后返回)。
// 在页面加载前执行,确保 api-client 首次 fetch 前 base 已就绪(无竞态)。
const apiBase = ipcRenderer.sendSync('storyweaver:get-api-base') as string;
contextBridge.exposeInMainWorld('__STORYWEAVER_API_BASE__', apiBase);
