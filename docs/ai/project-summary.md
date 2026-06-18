# Project Summary

Status: active（Phase 2 完成，进入 Phase 3 长篇记忆）

## Purpose

StoryWeaver — AI 辅助小说创作系统。通过多 Agent 协作实现「构思 → 写作 → 审稿 → 修订」全流程辅助，纯本地部署，人主导、AI 辅助。支持知识库管理、章节状态流转（draft→approved→published，可回退）、版本控制与 diff、全文搜索（章节/知识库/摘要）、章节摘要（发布自动生成）、审稿报告与 AI 修订。

## Core Modules

- **core/llm** — LLM 抽象层（OpenAI Provider，支持 `baseUrl` 兼容智谱 GLM 等）
- **core/agents** — 5 Agent（Writer / Brainstormer / Auditor / Summarizer / Curator）+ 路由层 + `BaseAgent`(chat / chatStream / chatStructured)
- **core/knowledge + core/search** — 结构化知识库（角色/世界观/物品/伏笔/规则/自定义）+ 关系图 + `InMemorySearchEngine`（倒排索引、中英文分词）
- **core/storage** — 文件系统存储（Book / Chapter / Version / Knowledge / Outline / Relation / Summary / Workspace）
- **studio/api** — Hono REST + SSE 后端（`/api/v1/*`）；services 层（book / chapter / chat / knowledge / workspace / summary / review）+ `FileWatcher`（启动索引现有文件 + 监听变化增量索引）
- **studio/pages** — React SPA：dashboard / chapters / chapter-edit / chat / knowledge / review / summaries / search / settings
- **studio/components** — Tiptap 编辑器、React Flow 关系图、`diff-viewer`、`confirm-dialog`、版本面板（带 diff）

## Tech Stack

- TypeScript + Node.js + pnpm monorepo（`core` + `studio`）
- 后端：Hono + @hono/node-server + tsx（dev）+ zod 校验
- 前端：React 19 + Vite 6 + Tailwind 4 + zustand + React Router 7 + Tiptap 3 + @xyflow/react + `diff`
- 测试：vitest（core + studio）

## Key Boundaries

- `studio ──depends──→ core`（单向）；core 无 React 依赖
- 纯文件存储（JSON + Markdown）为唯一数据源；内存搜索引擎靠 `FileWatcher` 增量索引
- 所有 AI 操作人手动触发；`published` 章节不可改（需先回退 draft）
- `chapterId` 为内部稳定 ID（永不重用）；「第N章」显示序号按全书位置算（跨卷连续）
- API Key 在项目根 `.env`（gitignored），永不出现在前端/日志
- 同一时间仅一个 AI 操作（`AIOperationQueue`）

## Recent Maintenance Notes

- 2026-06-18：大批 bugfix + 功能并已推送 main（5 提交）——审稿实质化 + AI 修订 diff、章节摘要（发布生成 + generating 状态持久化 + 独立页 + 重新生成）、全文搜索（去 slice 截断 + 摘要索引 + 卡片高亮分页）、章节编号连续 / 状态回退 draft / 删除限制（最新+未发布）、知识库注入对话、`ConfirmDialog` 替代 window.confirm、版本 diff 视图、`chatStructured` JSON 容错
- 2026-06-14：chat 路由测试修复，vitest 316 passed
- 2026-06-02：G02-S11 知识库前端管理 UI 完成
