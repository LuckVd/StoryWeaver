# Change Log

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
