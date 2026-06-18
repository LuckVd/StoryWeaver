# Current Goal

> **状态:待确认方案(`confirm_plan`)** — 数据层先行策略的第一个子目标。
> 前置 G03-S02(章节摘要结构化)经核对已在代码中**实质完成**(`SummaryService.summarizeChapter` 发布时生成并 `saveChapterSummary` 入库),roadmap 仍标 `pending/not_started`,待 `ai-sync` 时修正。

## Goal

G03-S04 — 时间线 + 角色状态变迁:在发布流程中维护 `memory/timeline.json` 与 `memory/character-states.json`,为长篇记忆(Layer1 状态快照 / Layer3 检索)提供结构化数据源。

## 背景

G02-S06 落地了 `ChapterSummary`(`plotEvents` / `stateChanges` / `narrativeTime` / `charactersPresent` / `locationsUsed`),发布时已生成入库。时间线与角色状态变迁是这些摘要的**派生视图**,目前没有任何类型/路径/存储。tech-spec §5.5 的发布总结流程明确要求:发布时更新时间线 + 角色状态变迁。

**关键洞察**:数据已在每章 `ChapterSummary` 里 → 时间线/角色状态可用**确定性聚合**生成,不必再调 LLM(省 token、可单测、结果稳定)。

## 验收标准

1. `memory/timeline.json` 存在,按章节升序聚合所有已发布章节的 `plotEvents` + `narrativeTime`,字段见下方类型
2. `memory/character-states.json` 存在,按角色聚合所有章节的 `stateChanges`,含「当前状态」+「完整变迁历史」
3. 批量发布(`WorkspaceService.publish`)与单章发布(`SummaryService` / chapters 路由)两条入口都会触发派生重建
4. 派生重建失败**不阻塞**发布流程(与现有 storyState 更新一致,catch 吞错)
5. 提供 `GET /api/v1/memory/timeline` + `GET /api/v1/memory/character-states`(为 G03-S08 页面铺路,且便于验证)
6. 聚合为**纯函数**,有完整单元测试;`pnpm build` 零错误,`pnpm test` 全绿

## 文件清单

### 新建
- `packages/core/src/memory/aggregator.ts` — 纯函数:`aggregateTimeline(summaries)` / `aggregateCharacterStates(summaries)`(为 G03-S01 `core/memory` 包铺第一个文件)
- `packages/core/src/memory/__tests__/aggregator.test.ts` — 聚合单测(多章、状态合并、排序、空输入)

### 修改
- `packages/core/src/models/memory.ts` — 新增 `TimelineEntry` / `Timeline` / `CharacterStateEntry` / `CharacterState` / `CharacterStates`
- `packages/core/src/models/index.ts` — 导出上述类型
- `packages/core/src/storage/path.ts` — 新增 `timelineFilePath`(`memory/timeline.json`)/ `characterStatesFilePath`(`memory/character-states.json`)
- `packages/core/src/storage/index.ts` — 导出新路径函数
- `packages/core/src/storage/summary-storage.ts` — 扩展 `saveTimeline` / `getTimeline` / `saveCharacterStates` / `getCharacterStates`(复用现有 IO 模式)
- `packages/core/src/index.ts` — 导出 `core/memory` 聚合函数
- `packages/studio/src/api/services/summary-service.ts` — 新增 `rebuildTimelineAndCharacterStates()`(读全部 summary → 聚合 → 存),`summarizeChapter` 成功后调用
- `packages/studio/src/api/services/workspace-service.ts` — `generateSummaries()` 末尾(更新 storyState 后)调用 `summaryService.rebuildTimelineAndCharacterStates()`
- `packages/studio/src/api/routes/memory.ts`(或挂到现有路由)— `GET /api/v1/memory/timeline` + `GET /api/v1/memory/character-states`

## 实现要点

### 1. 类型(`models/memory.ts`)

```typescript
export interface TimelineEntry {
  chapter: number; volume: number; title: string;
  narrativeTime?: string;
  events: string[];   // plotEvents
  outcome: string;    // plotOutcome
}
export interface Timeline { entries: TimelineEntry[]; updatedAt: string; }

export interface CharacterStateEntry { chapter: number; field: string; from: string; to: string; }
export interface CharacterState {
  entity: string;
  currentState: Record<string, string>;  // 各字段最新值
  history: CharacterStateEntry[];        // 按 chapter 升序
}
export interface CharacterStates { characters: CharacterState[]; updatedAt: string; }
```

### 2. 聚合纯函数(`core/memory/aggregator.ts`)

- `aggregateTimeline(summaries: ChapterSummary[]): Timeline` —— 按 `chapter` 升序映射成 `TimelineEntry`
- `aggregateCharacterStates(summaries: ChapterSummary[]): CharacterStates` —— 遍历 `stateChanges`,按 `entity` 分组;`currentState` 取每个 `field` 的**最后一次** `to`;`history` 保留全部变迁按 chapter 升序
- 纯函数、无 IO、无副作用 → 易测

### 3. 存储(`SummaryStorage` 扩展)

照 `saveStoryState`/`getStoryState` 模式:`ensureDir` + 覆盖写 / 读不存在返回 `null`。

### 4. 发布流程接入(两个入口)

- 批量:`WorkspaceService.generateSummaries()` 在更新 storyState 之后,调用注入的 `summaryService.rebuildTimelineAndCharacterStates()`
- 单章:`SummaryService.summarizeChapter()` 成功存库后调用同一方法
- 重建 = **全量**(读所有 summary 重新聚合),数据量小、确定性强;`POST /api/v1/memory/rebuild` 留作可选增强

## 测试计划

- `aggregator.test.ts`:多章聚合、角色状态合并(同字段多次变迁取最新)、按 chapter 排序、空数组、缺 `narrativeTime`
- `summary-storage` 扩展方法读写往返单测
- 发布流程:已有集成测试基础上,验证发布后 timeline/character-states 文件生成
- `pnpm build` + `pnpm test`(core + studio)

## Steps

1. **类型层** — `models/memory.ts` 新增 5 类型 + 导出
2. **路径层** — `path.ts` 新增 2 路径函数 + 导出
3. **聚合层** — `core/memory/aggregator.ts` 纯函数 + `core/index.ts` 导出
4. **存储层** — `SummaryStorage` 扩展 4 方法
5. **studio 协调** — `SummaryService.rebuildTimelineAndCharacterStates()` + 两入口接入
6. **API** — `GET /memory/timeline` + `GET /memory/character-states`
7. **测试与验证** — aggregator 单测 + storage 单测 + `pnpm build` + `pnpm test`

## 决策记录(已确认 2026-06-18)

1. **生成方式** = 确定性聚合(从已入库 `ChapterSummary` 聚合,不调 LLM;在发布流程总结阶段接入)
2. **存储归属** = 扩展 `SummaryStorage`(避免并行抽象)
3. **API 范围** = 本子目标做 `GET /api/v1/memory/timeline` + `GET /api/v1/memory/character-states`

## Parent Goal

- G03 — Phase 3: 长篇记忆 → **时间线 + 角色状态变迁(记忆数据源)**
