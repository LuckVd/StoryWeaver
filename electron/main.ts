import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { config } from 'dotenv';
import { launchServer, type LaunchedServer } from '../packages/studio/src/api/start';

// WSL/Linux root 下 electron sandbox 受限,关闭(本地单机应用,可接受)
app.commandLine.appendSwitch('no-sandbox');

// Phase 1 dev:API key 仍读项目根 .env(prod 打包无 .env,Phase 2 改应用内设置存 userData)
config({ path: join(process.cwd(), '.env') });

let win: BrowserWindow | null = null;
let server: LaunchedServer | null = null;

// preload 同步索取后端 loopback 基址(server 起好后返回完整 URL)
ipcMain.on('storyweaver:get-api-base', (event) => {
  event.returnValue = server ? `http://${server.hostname}:${server.port}` : '';
});

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win?.show());
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
  server = await launchServer({ port: 0, hostname: '127.0.0.1', loadEnv: false });
  console.log(`[StoryWeaver] 后端 loopback: http://${server.hostname}:${server.port}`);
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
