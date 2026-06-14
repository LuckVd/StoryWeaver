# Change Log

## 2026-06-02 — G02-S11: 知识库前端管理 UI

- Goal ID: G02-S11
- Summary: 知识库 `/knowledge` 页面重构为 7-Tab 布局（角色 | 世界观 | 物品 | 伏笔 | 规则 | 自定义 | 关系图），新增通用 `EntityList` + `EntityFormDialog`（含 `entitySelect` 模糊搜索关联字段），扩展 `knowledge-store` 为 6 种实体懒加载 CRUD；世界观/自定义 Tab 内嵌子分类子 Tab，关系图保留为末位 Tab。附带 chat SSE 改用原生 EventSource、`applyMessage` 返回 HTML
- Impact: `studio/src/pages/knowledge.tsx`, `studio/src/components/knowledge/{entity-list,entity-form-dialog}.tsx`, `studio/src/stores/knowledge-store.ts`, `studio/src/api/services/chat-service.ts`, `studio/src/api/routes/chat.ts`
- Tests: `pnpm build` 通过（tsc -b + Vite，2090 模块）；`pnpm test` 全量 `4 failed | 119 passed` —— 4 个失败均在 `chat.test.ts`（brainstormer/auditor/agentOverride 路由，症状为发消息后未追加 assistant 消息），**与 G02-S11 无关且早于 G02-S11 已存在**（父提交 976fc77 下同样 4 failed，已隔离验证）
- Dead Code: 未扫描（前端 UI 为主）
- Security: 无阻塞项（纯前端组件 + store；chat-service 改动不涉及密钥/路径暴露）
- Commit Status: 已提交 c4ef4c9

## 2026-05-28 — G02-S07: 章节状态流转

- Goal ID: G02-S07
- Summary: 前端章节状态流转交互。编辑页添加"提交审阅"（draft→approved）和"定稿发布"（approved→published）按钮，发布前 window.confirm 确认；章节列表 approved 行显示快捷发布按钮；chapter-store updateChapterStatus 刷新 currentChapter
- Impact: `studio/src/pages/chapter-edit.tsx`, `studio/src/pages/chapters.tsx`, `studio/src/components/chapter/{chapter-row,chapter-list}.tsx`, `studio/src/stores/chapter-store.ts`
- Tests: vitest 301 通过（core 187 + studio 114），`pnpm build` 零错误
- Dead Code: 无新增
- Security: 无阻塞项
- Commit Status: 待提交

## 2026-05-28 — G02-S10: 路由层完善

- Goal ID: G02-S10
- Summary: 完善 routeUserMessage 路由层。新增 LLM 兜底分类（可选 LLMClient，3s 超时降级为 writer），补充关键词规则（展开/删掉/比较/挑错/建议/回顾），新增斜杠命令 /summarize /curate，ChatService 传入 llmClient。向后兼容
- Impact: `core/src/agents/router.ts`, `core/src/agents/__tests__/router.test.ts`, `studio/src/api/services/chat-service.ts`
- Tests: vitest 301 通过（core 187 + studio 114，新增 15 个），`pnpm build` 零错误
- Dead Code: 无新增（改动范围小，纯逻辑改进）
- Security: 无阻塞项（LLM 调用复用已有 client，无新密钥/路径暴露）
- Commit Status: 待提交

## 2026-05-28 — G02-S08: 内存搜索引擎

- Goal ID: G02-S08
- Summary: 实现 InMemorySearchEngine（倒排索引 + 中英文分词 + scope 过滤）和搜索 API 端点 GET /search?q=...&scope=all。支持 chapters/knowledge/summaries 三种文档类型索引，多关键词取交集，标题匹配加分，结果含上下文片段
- Impact: `core/src/search/{search-engine,index}.ts`, `studio/src/api/routes/search.ts`, `core/src/index.ts`, `studio/src/api/{server,schemas}.ts`
- Tests: vitest 286 通过（core 172 + studio 114，新增 26 个），`pnpm build` 零错误
- Dead Code: 无新增（indexSummary/remove 为合理预留 API）
- Security: 无阻塞项（纯内存计算，无 I/O/密钥/环境变量）
- Commit Status: 待提交

- Goal ID: G02-S05
- Summary: 实现 WorkspaceService（工作区 CRUD + 发布流程）和 workspace API 路由（4 端点）。发布流程：校验 approved 状态 → 逐章状态锁定 published → SummarizerAgent 生成 ChapterSummary → 更新 StoryStateSnapshot → 从工作区移除 → SSE 广播进度/完成。无 LLM 时自动降级跳过摘要
- Impact: `studio/src/api/services/workspace-service.ts`, `studio/src/api/routes/workspace.ts`, `studio/src/api/{server,schemas}.ts`
- Tests: vitest 260 通过（core 152 + studio 108，新增 10 个），`pnpm build` 零错误
- Dead Code: 1 项修复 — 移除未使用 import `StoryStateSnapshot`
- Security: 无新增阻塞项（.env API key 为既有问题，已在 .gitignore 中）
- Commit Status: 待提交

## 2026-05-28 — G02-S06: Summarizer Agent

- Goal ID: G02-S06
- Summary: 实现 SummarizerAgent（章节摘要 / 剧情状态快照 / 多章综合总结）和 SummaryStorage（memory/summaries + memory/batch-summaries + memory/story-state.json 的 CRUD），6 个 memory 路径函数，summarizer 默认 prompt。Timeline 类型设计和 API 路由不含，留到 G03-S04 / G02-S05
- Impact: `core/src/agents/summarizer-agent.ts`, `core/src/storage/summary-storage.ts`, `core/src/storage/path.ts`, `core/src/agents/prompts.ts`, `core/src/agents/index.ts`, `core/src/storage/index.ts`
- Tests: vitest 250 通过（core 152 + studio 98，新增 29 个），`pnpm build` 零错误
- Dead Code: 无新增（SummarizerAgent/SummaryStorage 为 core 导出模块，供 G02-S05 调用）
- Security: 无阻塞项（路径遍历防护通过 resolveSafe，Zod schema 校验 LLM 输出，无密钥硬编码）
- Commit Status: 待提交

## 2026-05-28 — G02-S04: 审稿报告页面

- Goal ID: G02-S04
- Summary: 实现审稿报告 API 端点和前端页面。GET /chapters/:id/reviews 读取 reviews/ 目录返回报告列表（时间倒序），前端 score-card 组件（综合评分 + 7 维度评分条 + 颜色标识），issues-list 组件（按 severity 分组 + 维度标签 + 修改建议），review 页面（历史报告切换 + 返回编辑按钮）
- Impact: `studio/src/api/routes/reviews.ts`, `studio/src/pages/review.tsx`, `studio/src/components/review/{score-card,issues-list}.tsx`, `studio/src/{App,api/server}.tsx`
- Tests: vitest 221 通过（core 123 + studio 98，新增 5 个），`pnpm build` 零错误
- Dead Code: 无新增
- Security: 无阻塞项
- Commit Status: 待提交

## 2026-05-28 — G02-S03: Brainstormer + Auditor Agent

- Goal ID: G02-S03
- Summary: 实现 BrainstormerAgent（高温度 1.0，发散创意流式输出）和 AuditorAgent（低温度 0.3，流式审稿 + chatStructured 结构化 ReviewReport），重构 ChatService 从单一 WriterAgent 改为多 Agent 调度（根据 router 结果分发 brainstormer/writer/auditor），审稿报告自动保存到 reviews/ 目录
- Impact: `core/src/agents/{brainstormer-agent,auditor-agent,index}.ts`, `studio/src/api/services/chat-service.ts`, `studio/src/api/__tests__/chat.test.ts`
- Tests: vitest 216 通过（core 123 + studio 93，新增 15 个），`pnpm build` 零错误
- Dead Code: 无新增
- Security: 无阻塞项
- Commit Status: 待提交

## 2026-05-28 — G02-S01: 知识库系统

- Goal ID: G02-S01
- Summary: 实现知识库完整存储层 + API CRUD。`KnowledgeStorage`（characters 目录结构 + world 5 子分类 + items/hooks/rules 单文件 + custom 自定义目录），`OutlineStorage`（大纲树整棵读写），`RelationStorage`（关系边 CRUD），`KnowledgeService` 业务层，knowledge API 路由（概览 + 6 分类 CRUD + 大纲 + 关系，共 30+ 端点），Zod 校验 schemas。同时添加了 API 服务器启动入口（start.ts）、OPENAI_BASE_URL 环境变量支持、dev:api/dev:all 脚本
- Impact: `core/src/storage/{knowledge-storage,outline-storage,relation-storage,path,index}.ts`, `studio/src/api/{services/knowledge-service,routes/knowledge,schemas,server,start}.ts`, `studio/package.json`, `.env`
- Tests: vitest 201 通过（core 111 + studio 90，新增 60 个），`pnpm build` 零错误
- Dead Code: 2 项修复 — 移除未使用 import `rm`/`characterDir`；5 个 getter 方法预留给后续 API 扩展
- Security: 3 项修复 — world `sub` 参数 Zod 校验、custom `name` 参数 Zod 校验、API 绑定 127.0.0.1。无阻塞项，.env 已在 .gitignore 中
- Commit Status: 待提交

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
