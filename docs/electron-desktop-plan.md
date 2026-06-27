# StoryWeaver 桌面化方案(Electron,Windows 优先)

> 状态:方案设计(2026-06-27),分支 `feat/electron-desktop`。目标:打包成 Windows 桌面应用,双击即用,无需装 Node、无需手动启后端。

## 一、选型:为什么是 Electron

StoryWeaver 是 **Node/TS 全栈**:`packages/core`(引擎)+ `packages/studio/api`(Hono 后端 :3001)+ `packages/studio` 前端(React/Vite :3000,`fetch /api`)。

- **Electron 主进程就是 Node** → 可直接启动现有 Hono 后端,**后端逻辑零重写**。
- 前端继续 `fetch /api`,**几乎零改动**。
- 对照参考项目 DeepSeek-Reasonix(Wails + Go):**框架不同不能照搬**(Wails 要 Go 后端),但它那套桌面能力(单实例/托盘/自动更新/崩溃上报/多工作区)可 1:1 用 Electron API 实现。
- **代价**:体积(~100MB,Chromium)。对本地写作工具可接受;若将来极在意体积,再评估 Tauri + Node sidecar。

## 二、目标架构

```
StoryWeaver.exe(Electron 应用,electron-builder 打 NSIS 安装包)
├─ 主进程(electron/main.ts, Node)
│   ├─ launchServer()  → 复用 studio/api 启动逻辑,listen 127.0.0.1:<随机端口>
│   ├─ createWindow()  → 加载前端 dist(packages/studio/dist)
│   ├─ preload 注入后端端口给渲染进程
│   ├─ 单实例锁 / 托盘 / electron-updater / crashReporter(Phase 2+)
│   └─ 数据目录:保持 ~/.storyweaver/books(兼容现有多书数据)
└─ 渲染进程 = 现有 React SPA
    └─ api-client baseURL → 注入的 loopback 端口(生产);dev 仍走 vite 代理
```

## 三、关键改动点

### 1. 后端启动改造(`packages/studio/src/api/start.ts`)
- 现状:CLI 入口,固定 :3001,加载根 `.env`,启动 library-server + fileWatcher。
- 改造:抽出 `launchServer({ libraryRoot, port? }) → { port, close }`,供主进程调用;`port` 默认 `0`(OS 分配随机端口,避免冲突)。`.env` 读取保留(Phase 2 再改应用内设置)。

### 2. 前端 baseURL(`packages/studio/src/lib/api-client.ts`)
- 现状:`fetch('/api/v1/...')`,靠 vite 代理 :3001。
- 改造:baseURL 读 `window.__STORYWEAVER_API_BASE__`(preload 注入),缺省回退 `/api`(dev 仍走 vite 代理)。

### 3. Electron 主进程(新增 `electron/`)
- `electron/main.ts`:app ready → `launchServer()` → `createWindow()`(load dist)→ 注入端口。
- `electron/preload.ts`:`contextBridge` 暴露 API base / 退出等。
- Phase 2:`electron/tray.ts`(托盘,对照 DeepSeek `tray.go`)、`electron/updater.ts`(electron-updater,stable/canary channel,对照 `updater.go`)。

### 4. 数据目录
- 现有 `~/.storyweaver/books/<slug>/`(多书架构)。Electron 化后保持,或迁 `app.getPath('userData')`。**MVP 先保持 `~/.storyweaver`**(现有数据/迁移逻辑 `migrate.ts` 直接复用)。**待确认决策**。

### 5. 打包(`electron-builder`)
- Win:NSIS 安装包 + portable。
- 内容:core 预构建 `dist` + studio 前端 `dist` + `electron/` 主进程,asar 打包。
- 图标/版本/签名(签名留 Phase 3)。

## 四、分阶段计划

### Phase 1 — MVP:Win 上能跑(本次重点)
- [ ] `start.ts` 抽 `launchServer()` + loopback 随机端口
- [ ] 前端 baseURL 注入(preload)
- [ ] `electron/main.ts` + `preload.ts`,加载 dist
- [ ] `electron-builder` Win 打包配置
- [ ] **验收**:打包出的 exe 双击 → 见书架 → 能创作/切换多书 → 配 API key 后 AI 续写可用

### Phase 2 — 桌面体验(借鉴 DeepSeek)
- [ ] 单实例锁(`app.requestSingleInstanceLock`)
- [ ] 系统托盘 + 关闭到托盘
- [ ] 应用内设置面板(API key / 模型配置存 userData,不再靠 `.env`)
- [ ] 崩溃上报(`crashReporter`)

### Phase 3 — 分发
- [ ] 自动更新(electron-updater + channel)
- [ ] Win 代码签名
- [ ] GitHub Actions CI 构建
- [ ] macOS / Linux 扩展

## 五、风险与注意

| 项 | 说明 |
|---|---|
| **node:sqlite** | core 用 Node 内置 `node:sqlite`(`--experimental-sqlite`,非 better-sqlite3,无原生模块编译负担)。**需验证**:Electron 内置 Node 版本是否支持 `node:sqlite`(Electron 基于 Node 22+ 应可用);若不支持,需换 `better-sqlite3` 并 `electron-rebuild`。 |
| **API key** | 生产不能靠项目根 `.env`。Phase 2 改应用内设置存 userData。Phase 1 可临时保留 `.env` 读取。 |
| **体积** | Chromium ~100MB。 |
| **路径** | Win 路径分隔符、中文用户名目录,需测。 |
| **dev/prod 切换** | dev 走 vite(:3000 代理 :3001);prod(Electron)走 dist + loopback。打包前需 `core build` + `studio build`。 |

## 六、待确认决策

1. **数据目录**:MVP 保持 `~/.storyweaver`(推荐,零迁移)还是迁 `app.getPath('userData')`?
2. **MVP 范围**:Phase 1 仅"跑通",还是连带单实例/托盘?
3. **node:sqlite 兼容**:Phase 1 第一步先验证 Electron 能否跑通 `node:sqlite`,决定是否换 better-sqlite3。

## 七、参考
- DeepSeek-Reasonix `desktop/`(Wails):`single_instance.go` / `tray.go` / `updater.go` / crash / 多 workspace —— 桌面能力清单来源。
- electron-builder、electron-updater 官方文档。
