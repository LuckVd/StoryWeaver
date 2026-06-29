// Electron preload 注入后端 loopback 基址(http://127.0.0.1:<port>);
// dev(vite)下无注入 → 空 → '/api/v1' 走 vite 代理 → :3001
const API_BASE = (typeof window !== 'undefined' && window.__STORYWEAVER_API_BASE__) || '';
/** 统一 API 前缀:JSON(api 对象)与文件流(导出下载)共用,确保桌面版走注入的 loopback 基址 */
export const apiBase = `${API_BASE}/api/v1`;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
