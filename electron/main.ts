import { app, BrowserWindow, ipcMain, shell, Menu, screen } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { launchServer, type LaunchedServer } from '../packages/studio/src/api/start';

// WSL/Linux root 下 electron sandbox 受限,关闭(本地单机应用,可接受)
app.commandLine.appendSwitch('no-sandbox');

// Phase 1 dev:API key 仍读项目根 .env(prod 打包无 .env,Phase 2 改应用内设置存 userData)
config({ path: join(process.cwd(), '.env') });

let win: BrowserWindow | null = null;
let server: LaunchedServer | null = null;
let currentZoom = 1; // 界面缩放(用户设置优先,否则按物理像素估算)

// preload 同步索取后端 loopback 基址(server 起好后返回完整 URL)
ipcMain.on('storyweaver:get-api-base', (event) => {
  event.returnValue = server ? `http://${server.hostname}:${server.port}` : '';
});

// 自定义标题栏窗口控制(frame:false 下前端按钮经 IPC 调用)
ipcMain.handle('window:minimize', () => win?.minimize());
ipcMain.handle('window:maximize-toggle', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.handle('window:close', () => win?.close());

// ── 设置持久化(userData/settings.json) ──
interface AppSettings {
  zoom?: number;
}
function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json');
}
function readSettings(): AppSettings {
  try {
    const f = settingsFile();
    if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf-8')) as AppSettings;
  } catch {
    // 损坏则忽略,回退默认
  }
  return {};
}
function writeSettings(patch: Partial<AppSettings>): void {
  try {
    writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), ...patch }, null, 2));
  } catch {
    // 写失败不阻断
  }
}

/** 估算初始缩放:4K 及以上 + Windows 缩放偏低(<150%)时按物理像素比放大,使物理字号与 2K 一致 */
function estimateZoom(): number {
  const display = screen.getPrimaryDisplay();
  const physWidth = Math.round(display.size.width * display.scaleFactor);
  if (physWidth >= 3400 && display.scaleFactor < 1.5) {
    return Math.min(2, physWidth / 2560); // 4K(3840)≈ 1.5
  }
  return 1;
}

// 界面缩放 IPC:设置页滑块调用,持久化 + 实时应用
ipcMain.handle('zoom:get', () => currentZoom);
ipcMain.handle('zoom:set', (_event, value: number) => {
  currentZoom = Math.min(2.5, Math.max(0.5, Number(value) || 1));
  writeSettings({ zoom: currentZoom });
  win?.webContents.setZoomFactor(currentZoom);
  return currentZoom;
});

function applyZoom(): void {
  win?.webContents.setZoomFactor(currentZoom);
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false, // 无系统边框,前端自定义标题栏(朱批墨韵)
    backgroundColor: '#f5f1ea', // 纸白,避免启动白闪
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('maximize', () => win?.webContents.send('window:maximized', true));
  win.on('unmaximize', () => win?.webContents.send('window:maximized', false));

  // 界面缩放快捷键(VS Code 风格):Ctrl+= 放大 / Ctrl+- 缩小 / Ctrl+0 重置到估算值(临时,不持久化)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && !input.alt && !input.meta) {
      if (input.key === '=' || input.key === '+') {
        currentZoom = Math.min(2.5, +(currentZoom + 0.1).toFixed(2));
        applyZoom();
        event.preventDefault();
      } else if (input.key === '-') {
        currentZoom = Math.max(0.5, +(currentZoom - 0.1).toFixed(2));
        applyZoom();
        event.preventDefault();
      } else if (input.key === '0') {
        currentZoom = estimateZoom();
        applyZoom();
        event.preventDefault();
      }
    }
  });

  win.once('ready-to-show', () => {
    win?.show();
    applyZoom();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // dev:electron-vite 注入 ELECTRON_RENDERER_URL(vite dev server);prod:加载打包 renderer
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(join(__dirname, '../renderer/index.html'));

  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null); // 移除默认 File/Edit/View/Window 菜单(对写作应用无意义)
  currentZoom = readSettings().zoom ?? estimateZoom(); // 用户存的缩放优先,否则按屏幕估算
  server = await launchServer({ port: 0, hostname: '127.0.0.1', loadEnv: false });
  console.log(
    `[StoryWeaver] 后端 loopback: http://${server.hostname}:${server.port}  界面缩放: ${currentZoom}`,
  );
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async (event) => {
  if (server) {
    event.preventDefault();
    await server.close();
    server = null;
    app.quit();
  }
});
