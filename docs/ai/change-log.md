# Change Log

## 2026-05-27 — G01-S12: 版本控制 + 基础测试

- Goal ID: G01-S12
- Summary: 实现章节版本控制完整链路。`VersionStorage`（core 存储层，自增 ID + pruneOld + purgeAll），`ChapterService` 集成自动快照（save/ai_apply/status_change 触发），3 个 API 端点（list/read/restore），前端版本历史面板（version-panel.tsx），published 时自动清空版本
- Impact: `packages/core/src/storage/{version-storage,path,index}.ts`, `packages/studio/src/api/{services/chapter-service,services/chat-service,routes/chapters,schemas,server}.ts`, `packages/studio/src/{stores/chapter-store,components/editor/version-panel,pages/chapter-edit}.tsx`
- Tests: vitest 141 通过（core 83 + studio 58，含 10 个新增 version-storage 测试 + 4 个新增 chapters 版本端点测试），`pnpm build` 零错误
- Dead Code: 2 项修复 — 移除未使用 import `resolveSafe`，将动态 import `unlink` 改为静态 import
- Security: 无阻塞项，无密钥硬编码，路径遍历防护完善
- Commit Status: 待提交

## 2026-05-27 — G01-S11: AI 对话面板 + 独立对话页

- Goal ID: G01-S11
- Summary: 实现前端 AI 对话完整链路。`useChatSSE` Hook（EventSource + 自动重连），`useChatStore`（sessions/messages/streaming 状态），`ChatPanel` 可复用组件（消息列表 + 输入框 + SSE 流式 + Apply append/replace），章节编辑页双栏布局（编辑器 + 可折叠 Chat Panel），独立 `/chat` 页面（session 列表 + 自由对话）
- Impact: `packages/studio/src/{hooks/use-chat-sse,stores/chat-store,components/chat/*,pages/chapter-edit,pages/chat,components/layout/app-layout}.tsx`
- Tests: vitest 127 通过（core 73 + studio 54），`pnpm build` 零错误
- Dead Code: 2 项修复 — 移除未使用的 `export ChatPanelProps`，移除死变量 `sessions`
- Security: 无阻塞项，无密钥硬编码，无 XSS 向量
- Commit Status: 待提交

## 2026-05-27 — G01-S08: API 对话端点

- Goal ID: G01-S08
- Summary: 实现对话 API 完整链路。`ChatService`（内存 session 管理 + LLM 懒初始化 + Agent 路由 + 流式对话 + apply 到章节），6 个端点（session CRUD + messages + apply），复用 SSEEmitter 广播流式 token，AIOperationQueue 串行执行，Zod 校验
- Impact: `packages/studio/src/api/{services/chat-service,routes/chat,schemas,server}.ts`
- Tests: vitest 127 通过（core 73 + studio 54，含 9 个新增 chat 测试），`pnpm build` 零错误
- Dead Code: 未扫描
- Security: API Key 从 `process.env.OPENAI_API_KEY` 读取，无硬编码
- Commit Status: 待提交

## 2026-05-27 — G01-S10: 章节列表 + 编辑器

- Goal ID: G01-S10
- Summary: 实现章节列表页（按卷分组展示，创建/删除章节）和章节编辑页（Tiptap 编辑器，HTML 模式）。新增 `useChapterStore` 管理卷宗/章节状态，实现状态标签、创建对话框、字数统计、published 只读
- Impact: `packages/studio/src/{stores/chapter-store,components/chapter/*,components/editor/*,pages/chapters,pages/chapter-edit,App}.tsx`
- Tests: vitest 118 通过（core 73 + studio 45），`pnpm build` 零错误
- Dead Code: 未扫描（前端 UI 组件为主）
- Security: 无阻塞项
- Commit Status: 待提交

## 2026-05-27 — G01-S09: React 前端框架

- Goal ID: G01-S09
- Summary: 搭建 React 前端应用骨架。初始化 shadcn/ui（New York 风格 + Tailwind v4 CSS 变量），配置 React Router v7 路由（Dashboard/章节/对话/设置/404），实现 Sidebar 导航布局，Dashboard 页面（书籍概览卡片 + 创建表单），Zustand `useBookStore` 状态管理，API 客户端封装
- Impact: `packages/studio/src/{App,main}.tsx`, `components/{layout,ui}`, `pages/*`, `stores/book-store.ts`, `lib/api-client.ts`, `styles/globals.css`, `vite.config.ts`, `tsconfig.json`, `components.json`
- Tests: vitest 118 通过（core 73 + studio 45），`pnpm build` 零错误
- Dead Code: 未扫描（前端 UI 组件为主）
- Security: 无阻塞项，无密钥硬编码
- Commit Status: 待提交

## 2026-05-27 — G01-S07: API 章节 CRUD

- Goal ID: G01-S07
- Summary: 实现书籍/卷宗/章节完整 CRUD API。扩展 core 类型（`VolumeMeta`、`ChapterMeta`），新增 `VolumeIndexStorage`（per-volume `index.json`），创建 studio service 层（`BookService`、`ChapterService`）拆分业务逻辑，实现 3 组路由（book/volumes/chapters）+ Zod 校验 schema，章节状态流转 draft→approved→published（不可逆）
- Impact: `packages/core/src/models/book.ts`, `chapter.ts`, `storage/volume-index-storage.ts`, `path.ts`, `packages/studio/src/api/{services,routes,schemas,server}.ts`
- Tests: vitest 118 个测试全部通过（core 73 + studio 45），`pnpm build` 零错误
- Dead Code: `VersionTrigger` + `ChapterVersion` 未使用（G01-S12 预留），其余无死代码
- Security: 无阻塞项，无密钥硬编码
- Commit Status: 待提交

## 2026-05-27 — G01-S06: Hono API Server 基础

- Goal ID: G01-S06
- Summary: 在 `packages/studio/src/api/` 下搭建 Hono API Server 基础设施：`createServer()` 入口、全局错误处理中间件（`APIError` + `errorHandler`）、Zod 校验中间件工厂（`validate()`）、`SSEEmitter` 事件广播 + `GET /api/v1/events` SSE 端点、`AIOperationQueue` AI 操作串行队列、CORS 中间件
- Impact: `packages/studio/src/api/*`, `packages/studio/package.json`, `pnpm-lock.yaml`
- Tests: vitest 93 个测试全部通过（core 73 + studio 20），`pnpm build` 零错误
- Dead Code: 8 项发现，均为基础设施预留（`validate()`、`APIError`、`emit()`、`enqueue()` 等），无真正死代码，待 G01-S07+ 路由实现后复用
- Security: 无阻塞项。无 API Key 硬编码，无 `process.env` 直接访问
- Commit Status: 待提交

## 2026-05-25 — G01-S05: BaseAgent + WriterAgent

- Goal ID: G01-S05
- Summary: 在 `packages/core/src/agents/` 下实现 Agent 系统：BaseAgent 抽象基类（chat/chatStream/chatStructured）、WriterAgent（write/writeStream）、关键词路由（routeUserMessage，斜杠命令 + 中英文正则）、默认 Prompt 管理（loadPrompt + 内嵌默认 + 文件覆盖）
- Impact: `packages/core/src/agents/*`, `packages/core/src/index.ts`
- Tests: vitest 73 个测试全部通过（含 30 个新增 agent 测试），`pnpm build` 零错误
- Dead Code: 2 个 HIGH（`getDefaultPrompts()` 未使用导出、`_context` 未使用参数），均为预留接口，可延后
- Security: 无阻塞项，无密钥硬编码
- Commit Status: 待提交

## 2026-05-25 — G01-S04: LLM 抽象层

- Goal ID: G01-S04
- Summary: 在 `packages/core/src/llm/` 下实现 LLM 抽象层，包含 `LLMClient` 接口、`LLMProvider` 接口、`OpenAIProvider` 实现（普通补全 + 流式补全）、指数退避重试、`createLLMClient` 工厂函数、`registerProvider` 扩展钩子、Token 使用量提取
- Impact: `packages/core/src/llm/*`, `packages/core/src/index.ts`
- Tests: vitest 43 个测试全部通过（含 LLM 相关 8 个），`pnpm build` 零错误
- Dead Code: 1 个 HIGH 发现（`OpenAIProvider` 从 barrel 导出但仅内部使用，设计选择，可延后处理）
- Security: 无阻塞项。所有 apiKey 均为参数传入，无硬编码
- Commit Status: 待提交

## 2026-05-25 — G01-S03: 文件系统存储层

- Goal ID: G01-S03
- Summary: 在 `packages/core/src/storage/` 下实现文件存储层，包含 `resolveSafe` 路径安全校验、`BookStorage`（novel.yaml 读写）、`ChapterStorage`（章节 .md 读写）、`WorkspaceStorage`（workspace 读写）
- Impact: `packages/core/src/storage/*`, `packages/core/src/index.ts`
- Tests: vitest 35 个存储相关测试通过，`pnpm build` 零错误
- Dead Code: 无死代码发现
- Security: 路径遍历防护已实现（`resolveSafe` + `PathTraversalError`）
- Commit Status: 待提交

## 2026-05-24 — G01-S02: Core 类型定义

- Goal ID: G01-S02
- Summary: 在 `packages/core/src/models/` 下创建 10 个领域类型定义文件（book/chapter/config/knowledge/chat/memory/workspace/agent/review/api），统一导出供全项目使用
- Impact: `packages/core/src/models/*`, `packages/core/src/index.ts`, `packages/core/tsconfig.json`
- Tests: `pnpm build` 零错误，`tsc --noEmit` 零错误
- Dead Code: 无死代码，所有导出均可从入口可达
- Security: 无阻塞项。Advisory：`ModelConfig.apiKey` 字段需在 API 层实现时注意前后端分离
- Commit Status: 待提交

## 2026-05-24 — G01-S01: Monorepo 脚手架

- Goal ID: G01-S01
- Summary: 初始化 pnpm monorepo，创建 `@storyweaver/core` + `@storyweaver/studio` 包骨架，配置 TS/tsup/Vite/ESLint/Prettier
- Impact: 根配置文件，`packages/core/*`, `packages/studio/*`
- Tests: `pnpm install && pnpm build` 零错误
- Dead Code: not run
- Security: not run
- Commit Status: 待提交

## 2026-03-19

- Goal ID: bootstrap
- Summary: Initialized the Claude Code workflow skeleton.
- Impact: `docs/ai`, `.claude/commands`, `.claude/skills`, `.claude/agents`
- Tests: structure verification pending
- Dead Code: not run
- Security: not run
- Commit Status: not committed
