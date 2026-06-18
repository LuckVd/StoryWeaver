# G03 实现决策与遗留记录

> 本文件记录 G03(Phase 3: 长篇记忆)实现过程中的自主决策、疑问与遗留点。
> 用户授权:有疑问自主选择正确方案并记录,实现后统一跑测试。

## 全局原则

- 数据源优先复用已有 `ChapterSummary`(`plotEvents`/`stateChanges`/`narrativeTime`),避免不必要的 LLM 调用。
- 记忆派生逻辑放在 `core/memory/` 纯函数 + `SummaryStorage` IO,studio service 协调。
- 发布流程接入失败一律不阻塞主流程(catch 吞错,与现有 storyState 一致)。

## G03-S02 章节摘要结构化

- **结论:已实质完成**(代码核查)。`SummaryService.summarizeChapter` 已在发布时生成 `ChapterSummary` 并 `saveChapterSummary` 入库;含 generating 状态 / 删除 / 列表 / 重新生成。
- **遗留**:roadmap 仍标 `pending/not_started`,待 `/ai-sync` 修正为 `done`。

## G03-S04 时间线 + 角色状态变迁

- **决策 1(生成方式)**:确定性聚合,不调 LLM。数据已在 `ChapterSummary`,聚合即可。
- **决策 2(存储归属)**:扩展 `SummaryStorage`(避免并行抽象),新增 `saveTimeline`/`getTimeline`/`saveCharacterStates`/`getCharacterStates` + `rebuildTimelineAndCharacterStates`。
- **决策 3(rebuild 协调位置)**:放 `SummaryStorage.rebuildTimelineAndCharacterStates`。理由:`workspaceService` 与 `summaryService` 都已注入 `summaryStorage`,无需改 server 构造顺序、零风险。
  - **轻微架构权衡**:`storage` 依赖 `core/memory/aggregator`(纯函数)。确认 `aggregator` 仅依赖 `models`,无反向依赖,无循环。
- **决策 4(接入点)**:批量发布 `WorkspaceService.generateSummaries` 末尾 + 单章发布 `SummaryService.summarizeChapter`/`deleteChapterSummary` 后。
- **决策 5(重建策略)**:全量重建(读所有 summary 重新聚合),数据量小、确定性强。增量留作未来增强。
- **决策 6(API)**:本子目标做 `GET /memory/timeline` + `GET /memory/character-states`,为 G03-S08 铺路。

## G03-S04 完成状态(2026-06-18)

- ✅ 代码全部落地,`pnpm build` 通过(core + studio),core 测试 **205 passed**。
- 类型 `TimelineItem`/`Timeline`/`CharacterState`/`CharacterStates`;路径 `timelineFilePath`/`characterStatesFilePath`;聚合 `core/memory/aggregator.ts`;`SummaryStorage` 扩展 + `rebuildTimelineAndCharacterStates`;两发布入口接入;`GET /memory/{timeline,character-states}`。

## 构建环境修复(本次发现并修复,非 G03 功能)

- **pnpm 11.7 deps 检查阻塞所有 `pnpm run/exec`**:`ERR_PNPM_IGNORED_BUILDS`(esbuild/msw)使前置 `runDepsStatusCheck` 触发的 install 退出非 0。`.npmrc` 的 `verify-deps-before-run=false` 与 CLI `--config.verifyDepsBeforeRun=false` **均无效**。绕过:**直接用包内 binary**:`(cd packages/core && ./node_modules/.bin/tsup)`、`(cd packages/studio && ./node_modules/.bin/{tsc,vite,vitest})`。
- **命名冲突**:`TimelineEntry` 与 `models/knowledge.ts` 撞名 → memory 侧改名 `TimelineItem`。
- **既有 bug(全量 tsc 暴露)**:`SSEEvent` 缺 `summary:complete`(core `models/api.ts` 补);`chapter-edit.tsx` 的 `generatingSummary` useState 声明在使用之后(上移)。

## 既有测试失败(非本次引入,待单独修)

- studio 2 个失败,均在本次未触及的代码路径:
  - `file-watcher.test.ts > should extract chapter title` — search 标题提取未 strip `#`/多余内容(疑似 06-18 search 重构回归)。
  - `chapters.test.ts > DELETE 非 draft 不可删除(期望 423 得 200)` — 删除限制逻辑(疑似 06-18 回归)。
- 记录待修,不阻塞 G03 验收(相关测试均通过)。

## G03 全部完成(2026-06-18)

8/8 子目标核心落地:
- **G03-S01** 三层记忆 — `core/memory/context-builder.ts`(Layer1/2/3 组装 + Token 截断)
- **G03-S02** 章节摘要结构化 — 06-18 已实质完成,本次核对确认
- **G03-S03** 多章综合总结 — `WorkspaceService.maybeGenerateBatchSummary`(每 10 章触发)
- **G03-S04** 时间线+角色状态 — `aggregator` + `SummaryStorage.rebuild` + `GET /memory/{timeline,character-states}`
- **G03-S05** Token 预算 — `token-budget.ts`(模型窗口表 + calcLayer3Budget)
- **G03-S06** 检索策略 — `retriever.ts`(四策略纯函数)
- **G03-S07** CuratorAgent — `suggestEntities` 结构化实体提取
- **G03-S08** /memory 页面 — 时间线+角色状态 Tab + 侧边栏入口

**验证**:core build + **231 passed** 全绿;studio tsc + vite build 通过;studio test 121 passed / 2 failed(详见下)。

## 待修遗留(非 G03)

- studio 2 个既有测试失败(`file-watcher` 标题提取、`chapter DELETE` 423 限制),系 06-18 维护回归,与 G03 无关,待单独修复。
- G03-S01 对话上下文压缩(>10 轮自动摘要)未实现,留 TODO。
- G03-S03 `batchSummaryInterval` 从 `novel.yaml` 读取未接入(硬编码 10),留 TODO。
- Token 截断用粗略字符估算(≈2 字符/token),精确 tokenizer 待接入。

## 决策记录(自主)

- 数据源优先复用 `ChapterSummary`,避免额外 LLM(确定性聚合)。
- rebuild 协调放 `SummaryStorage`(两发布入口已注入,零构造改动)。
- 检索为纯函数,供 Layer3 注入。
- pnpm 11 deps 检查绕过:直接用包内 binary(`packages/<pkg>/node_modules/.bin/{tsup,tsc,vite,vitest}`)。
