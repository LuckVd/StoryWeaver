# Current Goal

> **状态:G03 代码已实现(`b9937aa`)+ 审查发现的 P0/P1/P2 已全部修复并验证全绿(core 231 + studio 123 = **354 tests**),未 commit、未 sync、未 merge。**
> 分支 `feat/g03-memory`。原 `current-goal.md` 残留 G03-S04 `confirm_plan`,已于 2026-06-19 修正。

## Goal

G03 — Phase 3:长篇记忆(三层记忆系统 + 派生记忆 + CuratorAgent)

## 本轮已完成(2026-06-19 审查 + 修复)

对 `b9937aa` 的 G03 实现做完整审查,修复全部发现项:

- **P0-1 批量假摘要** — `workspace-service` 批量发布改用去标签正文(原仅传标题,LLM 凭标题编造情节,污染 timeline/character-states/batch-summary 全链)
- **P0-2 记忆注入链路** — `chat-service` 为 Writer/Auditor 注入三层记忆(原 `buildMemoryContext`/`retrieveRemoteMemory`/`CuratorAgent` 在 studio 零调用,链路完全断开);`server.ts` 调整依赖注入顺序
- **P1-1 CuratorAgent 集成** — 发布后异步提取实体建议 → `memory/curation-suggestions.json`(待人工确认)+ `GET /memory/curation` + `POST /chapters/:id/curate`(原孤儿代码)
- **P1-2 token 估算** — `length/2` → `length/1`(中文 1 字 ≈ 1 token,原低估 2-3× 易溢出)
- **P1-3 知识库注入预算** — `buildKnowledgeContext` 加字符上限截断(原全量无控制,绕过 S05 预算体系)
- **P1-4 远期检索接入** — `retrieveRemoteMemory` 用近期角色/地点关键词召回相关章节/待回收伏笔/综合总结(原零调用)
- **P2 清理** — `getModelContextWindow` 前缀匹配按长度降序、`maybeGenerateBatchSummary` 补齐跳发区间、retriever 过滤过短关键词、存储取目录统一用 `memoryDir`
- **B1/B2(pre-existing 测试失败)** — chapters DELETE 非 draft 返回 423(原 approved 可删)、file-watcher 标题提取支持 markdown `#`

**验证**:`pnpm build` 全绿(core + studio tsc + vite);`pnpm test` core 231 + studio 123 = **354 全绿**(原 2 个 pre-existing 失败已修,无新增回归)。注:`pnpm install` 后 build 才过(`diff`/`@types/diff` 此前未装)。

## 改动文件

- core:`memory/{context-builder,retriever,token-budget}.ts`、`storage/{path,summary-storage}.ts`、`models/{api,memory}.ts`
- studio:`api/server.ts`、`api/services/{chat-service,summary-service,workspace-service,chapter-service,file-watcher}.ts`、`api/routes/{chapters,memory}.ts`

## 下一步

1. commit 本轮修复(符合无 AI 署名规范)
2. `ai-sync` 同步 G03 状态到 roadmap
3. merge `feat/g03-memory` → `main`

## Parent Goal

- G03 — Phase 3:长篇记忆
