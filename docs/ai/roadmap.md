# 项目路线图

本文件是项目总体技术设计与长期进度的唯一事实来源。

使用原则：

- 总体技术方向、阶段规划、目标拆分、依赖关系统一写在这里。
- 当前正在执行的目标细节写在 `current-goal.md`，不要把步骤级执行过程堆到本文件。
- 路线图中的目标和子目标必须使用稳定编号，便于依赖跟踪和同步。
- 目标完成后的实现结果、测试结果、提交记录应回写到本文件表格中。

## 1. 项目概述

- **项目名称**：StoryWeaver — AI 辅助小说创作系统
- **技术目标**：构建一套个人 AI 辅助小说创作系统，通过多 Agent 协作实现"构思 → 写作 → 审稿 → 修订"全流程辅助，纯本地部署，人主导 AI 辅助
- **技术栈**：TypeScript + Node.js + React 19 + Hono + pnpm monorepo
- **详细方案**：`docs/ai/tech-spec-v1.md`
- **当前阶段**：Phase 2 完成 → Phase 3 长篇记忆

## 2. 总体技术架构

### 2.1 核心模块

| 模块ID | 模块名称 | 包 | 职责 | 关键接口/输入输出 |
|---|---|---|---|---|
| M01 | LLM 抽象层 | core/llm | 统一多模型调用接口 | `LLMClient` → `chatCompletion` / `chatCompletionStream` |
| M02 | Agent 系统 | core/agents | 5 Agent + 路由层 | `BaseAgent.chat` / `chatStream` / `chatStructured` |
| M03 | 记忆系统 | core/memory | 三层记忆 + Token 预算 + 检索 | Layer 1/2/3 组装，`TokenBudget` 计算 |
| M04 | 知识库 | core/knowledge | 结构化设定存储 + 关系图 | CRUD + 邻接表关系图 + 搜索引擎 |
| M05 | 文件存储层 | core/storage | 文件系统读写抽象 | novel.yaml / chapters(.md) / knowledge(.json) |
| M06 | 工作区 & 发布 | core/workspace | 工作区管理 + 发布流程 | 章节锁定 + Summarizer 自动总结 |
| M07 | API Server | studio/api | Hono HTTP + SSE 后端 | `/api/v1/*` REST + SSE 流式 |
| M08 | Web 前端 | studio/pages... | React SPA 工作台 | Tiptap 编辑器 + 对话面板 + 知识库 UI |

### 2.2 关键集成关系

- `studio/api` 调用 `core/agents` → AI 操作
- `core/agents` 调用 `core/llm` → LLM 请求
- `core/agents` 调用 `core/memory` → 记忆检索与注入
- `core/agents` 调用 `core/knowledge` → 知识库查询
- `studio/api` 调用 `core/storage` → 文件读写
- `studio/api` 调用 `core/workspace` → 工作区与发布管理
- `studio/pages` 通过 SSE 接收流式 AI 输出

## 3. 设计约束

- 纯文件存储为唯一数据源（JSON + Markdown），后期可选加 SQLite 缓存层
- 数据访问层抽象为接口，底层实现可替换
- 所有 AI 操作由人手动触发，AI 不自动执行任何写作/审稿/修订
- 已发布 (published) 的章节不可修改，情节固化成为"事实"
- API Key 存储在 .env 文件中，永不出现在日志或前端（脱敏展示）
- 所有 API 输入使用 Zod Schema 校验
- 文件路径操作必须防止路径遍历攻击
- 同一时间只允许一个 AI 操作，其他排队
- 包依赖：`studio ──depends──→ core`

## 4. 阶段目标

### G01 — Phase 1: MVP

- **目标名称**：基本可用的写作工具
- **目标范围**：monorepo 脚手架、LLM 层（OpenAI）、WriterAgent、文件存储、Hono API（章节 CRUD + 对话）、React 前端（编辑器 + 对话面板）、版本控制、基础测试
- **完成标准**：`pnpm dev` 可启动，能创建/编辑章节，AI 对话可流式续写并 Apply 到章节，版本可快照/回退

### G02 — Phase 2: 核心流水线

- **目标名称**：完整的知识库 + 审稿 + 工作区
- **目标范围**：知识库 CRUD + 关系图、BrainstormerAgent + AuditorAgent、审稿报告页、工作区管理 + 发布流程、SummarizerAgent、章节状态流转、内存搜索引擎、文件监听、路由层
- **完成标准**：知识库可管理角色/世界观/伏笔，可触发 AI 审稿并查看报告，工作区可发布章节并自动总结

### G03 — Phase 3: 长篇记忆

- **目标名称**：支持百万字长篇
- **目标范围**：三层记忆系统、章节摘要结构化、多章综合总结、时间线 + 角色状态变迁、Token 预算管理、检索策略、CuratorAgent
- **完成标准**：AI 写作时能自动检索远期相关内容，发布时自动生成摘要/时间线/角色状态，Token 开销可控

### G04 — Phase 4: 多模型 + 高级特性

- **目标名称**：生产级多模型适配 + 高级功能
- **目标范围**：Anthropic/Ollama Provider、模型配置管理页、Agent 模型分配、大纲编辑器、导出（TXT/EPUB/MD）、数据统计、Prompt 管理 UI、对话历史管理
- **完成标准**：可切换不同 AI 模型，可导出小说，可管理 Prompt 模板

### G05 — Phase 5: 打磨

- **目标名称**：体验优化
- **目标范围**：纸张/手稿视觉风格、深色模式、动效、快捷操作条、响应式布局、性能优化、错误处理完善
- **完成标准**：视觉风格符合设计系统，大项目下响应流畅

### G06 — Phase 6: 生产化

- **目标名称**：发布就绪
- **目标范围**：测试覆盖、用户文档、npm 发布、CI/CD
- **完成标准**：可通过 `npx ai-novel --open` 一键启动

## 5. 路线图进度表

| 目标ID | 子目标ID | 名称 | 描述 | 状态 | 前置依赖 | 风险/阻塞 | 验收结果 | 测试状态 | 实现时间 | Commit ID | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G01 | | Phase 1: MVP | 基本可用的写作工具 | done | | | accepted | passed | 2026-05-27 | | 12/12 子目标完成，MVP 完成 |
| G01 | G01-S01 | Monorepo 脚手架 | 根 package.json、pnpm-workspace、TS 配置、core/studio 包骨架、ESLint/Prettier | done | | | accepted | passed | 2026-05-24 | | |
| G01 | G01-S02 | Core 类型定义 | models/ — Book, Chapter, Config, Knowledge, Chat 等类型 + 统一导出 | done | G01-S01 | | accepted | passed | 2026-05-24 | | |
| G01 | G01-S03 | 文件系统存储层 | storage/ — novel.yaml 读写、章节 .md 读写、workspace 读写、路径安全 | done | G01-S02 | | accepted | passed | 2026-05-24 | | |
| G01 | G01-S04 | LLM 抽象层 | llm/ — LLMClient 接口、OpenAI Provider、Token 计数 | done | G01-S01 | | accepted | passed | 2026-05-24 | | 先只支持 OpenAI |
| G01 | G01-S05 | BaseAgent + WriterAgent | agents/ — BaseAgent 基类、WriterAgent、关键词路由、Writer Prompt | done | G01-S04 | | accepted | passed | 2026-05-25 | | Phase 1 仅关键词路由，LLM 兜底留后续 |
| G01 | G01-S06 | Hono API Server 基础 | api/server.ts、错误处理中间件、SSE 基础设施、全局事件流 (`GET /api/v1/events`)、AI 操作队列 (AIOperationQueue)、Zod 校验 | done | G01-S01 | | accepted | passed | 2026-05-27 | | createServer + SSEEmitter + AIOperationQueue + validate + errorHandler |
| G01 | G01-S07 | API 章节 CRUD | api/routes/book.ts + chapters.ts — 完整 CRUD + 状态流转 | done | G01-S03, G01-S06 | | accepted | passed | 2026-05-27 | | book/volumes/chapters 路由 + VolumeIndexStorage + service 层 |
| G01 | G01-S08 | API 对话端点 | api/routes/chat.ts — session 管理 + SSE 流式 + apply + Agent 重试策略（各 Agent 不同 timeout/retry） | done | G01-S05, G01-S07 | | accepted | passed | 2026-05-27 | | ChatService + 6 端点 + routeUserMessage + WriterAgent 流式 + apply |
| G01 | G01-S09 | React 前端框架 | Vite + React 19 + React Router + Tailwind + shadcn/ui + Zustand + Sidebar Layout + Dashboard 页 (`/`) | done | G01-S01 | | accepted | passed | 2026-05-27 | | Sidebar + Dashboard + Zustand book-store + React Router v7 + shadcn/ui |
| G01 | G01-S10 | 章节列表 + 编辑器 | ChapterList 页 + ChapterEditor 页 (Tiptap HTML 模式) | done | G01-S09 | | accepted | passed | 2026-05-27 | | 按卷分组列表 + Tiptap 编辑器 + 创建/删除 + 字数统计 |
| G01 | G01-S11 | AI 对话面板 + 独立对话页 | 编辑器内 chat 组件 + 独立 `/chat` 页面（不绑定章节的自由对话）— 消息列表 + 输入框 + SSE 流式显示 + Apply 按钮 | done | G01-S08, G01-S10 | | accepted | passed | 2026-05-27 | | SSE Hook + ChatStore + ChatPanel + 编辑器双栏 + 独立对话页 + append/replace |
| G01 | G01-S12 | 版本控制 + 基础测试 | 章节版本快照/回退 API + 前端历史面板 + core/api 测试 | done | G01-S07, G01-S11 | | accepted | passed | 2026-05-27 | | VersionStorage + 3 API 端点 + 自动快照 + published 清空 + 前端面板 |
| G02 | | Phase 2: 核心流水线 | 完整的知识库 + 审稿 + 工作区 | done | G01 | | accepted | passed | 2026-05-28 | | 11/11 子目标完成，Phase 2 完成（G02-S11 补全知识库前端管理） |
| G02 | G02-S01 | 知识库系统 | knowledge/ — 角色/世界观/物品/伏笔/规则 CRUD | done | G01-S03 | | accepted | passed | 2026-05-28 | | KnowledgeStorage + OutlineStorage + RelationStorage + API 路由 |
| G02 | G02-S02 | 关系图 + 可视化 | 邻接表存储 + React Flow 前端 | done | G02-S01 | | accepted | passed | 2026-05-28 | | React Flow 关系图 + 全实体类型节点 + 添加/删除关系 + 知识库导航 |
| G02 | G02-S03 | Brainstormer + Auditor Agent | 构思 Agent + 审稿 Agent 实现 | done | G01-S05 | | accepted | passed | 2026-05-28 | | BrainstormerAgent + AuditorAgent + ChatService 多 Agent 调度 |
| G02 | G02-S04 | 审稿报告页面 | 评分卡 + 问题列表 + 原文对照 | done | G02-S03, G01-S10 | | accepted | passed | 2026-05-28 | | reviews API + score-card + issues-list + review 页面 |
| G02 | G02-S05 | 工作区管理 + 发布流程 | workspace 管理 + publish 流程 + SSE 进度 | done | G01-S07 | | accepted | passed | 2026-05-28 | | WorkspaceService + workspace 路由（4 端点）+ 发布流程（状态锁定 + AI 摘要 + SSE） |
| G02 | G02-S06 | Summarizer Agent | 章节摘要 + 时间线 + 角色状态 + 综合总结 | done | G01-S05 | | accepted | passed | 2026-05-28 | | SummarizerAgent + SummaryStorage + memory 路径函数，Timeline/API 留到后续子目标 |
| G02 | G02-S07 | 章节状态流转 | draft → approved → published 完整流程 | done | G02-S05 | | accepted | passed | 2026-05-28 | | 前端状态流转按钮 + 确认提示 + 列表快捷发布 + store 刷新 |
| G02 | G02-S08 | 内存搜索引擎 | 倒排索引 + 分词 + 搜索 API | done | G01-S03 | | accepted | passed | 2026-05-28 | | InMemorySearchEngine + 中英文分词 + scope 过滤 + search API |
| G02 | G02-S09 | 文件监听 | chokidar 监听 volumes/ + knowledge/ + SSE 通知 | done | G02-S08 | | accepted | passed | 2026-05-28 | | FileWatcher + SearchEngine 增量更新 + SSE 广播 + server.ts 集成 |
| G02 | G02-S10 | 路由层完善 | 关键词路由 + LLM 兜底路由 | done | G02-S03 | | accepted | passed | 2026-05-28 | | LLM 兜底分类 + 3s 超时降级 + 补充关键词 + 新斜杠命令 |
| G02 | G02-S11 | 知识库前端管理 UI | /knowledge 7-Tab 布局 + 6 实体 CRUD + 关系图 | done | G02-S01, G02-S02 | | accepted | passed | 2026-06-02 | c4ef4c9 | EntityList + EntityFormDialog（含 entitySelect 模糊搜索）+ knowledge-store 懒加载 CRUD + 世界观/自定义子 Tab；build 通过，全量 suite 存在 4 个与 G02-S11 无关的既有 chat 路由测试失败 |
| G03 | | Phase 3: 长篇记忆 | 支持百万字长篇 | planned | G02 | 依赖知识库和 Summarizer | pending | not_started | | | |
| G03 | G03-S01 | 三层记忆系统 | Layer 1 永久记忆 + Layer 2 近期 + Layer 3 远期 + 对话上下文压缩（>10 轮自动摘要） | planned | G02-S06 | | pending | not_started | | | |
| G03 | G03-S02 | 章节摘要结构化 | ChapterSummary 结构化生成 | planned | G02-S06 | | pending | not_started | | | |
| G03 | G03-S03 | 多章综合总结 | BatchSummary + 间隔配置 | planned | G03-S02 | | pending | not_started | | | |
| G03 | G03-S04 | 时间线 + 角色状态变迁 | AI 维护 timeline.json + character-states.json | planned | G03-S02 | | pending | not_started | | | |
| G03 | G03-S05 | Token 预算管理 | 动态计算 Layer 3 预算，适配不同模型窗口 | planned | G03-S01 | | pending | not_started | | | |
| G03 | G03-S06 | 检索策略 | 角色关联/伏笔驱动/大纲指引/综合总结兜底 | planned | G03-S01, G02-S08 | | pending | not_started | | | |
| G03 | G03-S07 | CuratorAgent | 知识库辅助 Agent | planned | G01-S05 | | pending | not_started | | | |
| G03 | G03-S08 | AI 记忆浏览页面 | `/memory` 页面 — 摘要/时间线/角色状态浏览 | planned | G03-S02, G01-S09 | | pending | not_started | | | |
| G04 | | Phase 4: 多模型 + 高级特性 | 生产级多模型适配 + 高级功能 | planned | G03 | | pending | not_started | | | |
| G04 | G04-S01 | Anthropic / Ollama Provider | 多模型 Provider 实现 | planned | G01-S04 | | pending | not_started | | | |
| G04 | G04-S02 | 模型配置管理页 | 添加/编辑/删除/测试模型 | planned | G04-S01, G01-S09 | | pending | not_started | | | |
| G04 | G04-S03 | Agent 模型分配 | 一键默认 + 单独覆盖 | planned | G04-S02 | | pending | not_started | | | |
| G04 | G04-S04 | 大纲编辑器 | 树状大纲编辑 + 与知识库联动 | planned | G02-S01, G01-S09 | | pending | not_started | | | |
| G04 | G04-S05 | 导出功能 | TXT / EPUB / Markdown 导出 | planned | G01-S03 | | pending | not_started | | | |
| G04 | G04-S06 | 数据统计看板 | 字数/进度/活动等数据图表 | planned | G01-S09 | | pending | not_started | | | |
| G04 | G04-S07 | Prompt 管理 UI | 查看/编辑/恢复默认 Prompt | planned | G01-S09 | | pending | not_started | | | |
| G04 | G04-S08 | 对话历史管理 | session 列表/搜索/删除 | planned | G01-S08 | | pending | not_started | | | |
| G05 | | Phase 5: 打磨 | 体验优化 | planned | G04 | | pending | not_started | | | |
| G05 | G05-S01 | 纸张/手稿视觉风格 | 衬线字体、纹理背景、柔和阴影 | planned | G01-S10 | | pending | not_started | | | |
| G05 | G05-S02 | 深色模式 | 亮色=羊皮纸/墨水，暗色=深色/烛光 | planned | G05-S01 | | pending | not_started | | | |
| G05 | G05-S03 | 动效优化 | 页面淡入、消息滑入、按钮缩放 | planned | G01-S09 | | pending | not_started | | | |
| G05 | G05-S04 | 快捷操作条 | [构思] [续写] [审稿] 一键触发 | planned | G01-S11 | | pending | not_started | | | |
| G05 | G05-S05 | 响应式布局 | 适配不同屏幕尺寸 | planned | G01-S09 | | pending | not_started | | | |
| G05 | G05-S06 | 性能优化 | 大项目下的响应速度 | planned | G02-S08 | | pending | not_started | | | |
| G05 | G05-S07 | 错误处理完善 | Toast 重试提示、错误卡片、内容保护 | planned | G01-S08 | | pending | not_started | | | |
| G06 | | Phase 6: 生产化 | 发布就绪 | planned | G05 | | pending | not_started | | | |
| G06 | G06-S01 | 完善测试覆盖 | 单元/集成/E2E 测试 | planned | G05 | | pending | not_started | | | |
| G06 | G06-S02 | 用户文档 | 使用说明 + API 文档 | planned | G05 | | pending | not_started | | | |
| G06 | G06-S03 | npm 发布 | `npx ai-novel --open` 一键启动 | planned | G06-S01 | | pending | not_started | | | |
| G06 | G06-S04 | CI/CD | 自动构建/测试/发布流水线 | planned | G06-S03 | | pending | not_started | | | |

## 6. 开放风险与阻塞

- **LLM Provider 兼容性**：不同模型的 API 行为差异（流式格式、错误码）需在 Phase 4 逐一验证
- **Token 计数精度**：不同模型 tokenizer 不同，影响 Token 预算计算准确性
- **Tiptap Markdown 兼容性**：复杂排版（表格、嵌套列表）的 Markdown 互转可能有损
- **EPUB 导出**：EPUB 格式复杂，可能需要引入额外依赖（如 epub-gen-memory）
