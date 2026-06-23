# Current Goal

> **状态:G03(Phase 3 长篇记忆)已完成并同步,merge 到 main。下一步进入 Phase 4(G04)。**

## 上一目标

G03 — Phase 3:长篇记忆(8 子目标全部完成)。2026-06-19 对基线 `b9937aa` 做完整审查,修复全部 P0/P1/P2 + 2 个既有测试失败 + 1 个章节号显示 bug,接入 LLM(智谱 glm-4-flash),`core 231 + studio 123 = 354` 测试全绿。详见 `change-log.md` 2026-06-19。

## 下一目标(待选)

**G04 — Phase 4:多模型 + 高级特性**(roadmap 全部 `planned`)。候选子目标:

- G04-S01 Anthropic / Ollama Provider
- G04-S02 模型配置管理页(配 key / 切模型)
- G04-S03 Agent 模型分配
- G04-S04 大纲编辑器(树状大纲 + 知识库联动)
- G04-S05 导出(TXT / EPUB / Markdown)← 独立、用户可感知
- G04-S06 数据统计看板
- G04-S07 AI 工具调用 tool use(用户 2026-06-16 反馈,暂缓)
- G04-S08 Prompt 管理 UI
- G04-S09 对话历史管理

需先用 `/ai-goal` 选定子目标并做方案设计后再实现。

## 特性记录:伏笔追踪替换时间线(/memory 页,2026-06-24)

**背景**:时间线对复杂叙事(回忆/穿越/多世界)是错误抽象 —— `narrativeTime` 提取不准(第2章把回溯时间全塞进来),且与章节摘要内容重复。改用「伏笔追踪」:按**章节序**(不受叙事时间结构影响)+ 驱动 AI 写作的伏笔注入,零增量维护。

**实现**:
- 删 timeline 全链:core 类型(`Timeline`/`TimelineItem`)、`aggregateTimeline`、`saveTimeline`/`getTimeline`、`timelineFilePath`、`GET /memory/timeline`、前端时间线 Tab;`context-builder` Layer3 兜底改用 `characterStates`
- 新增伏笔追踪:core `aggregateHooksTracking`(Hook 实体 + 章节摘要 `hooksPlanted`/`hooksAdvanced` 确定性聚合 → `HookTracking`:状态/埋设章/最近推进/沉默章数/轨迹)+ `GET /memory/hooks-tracking` + 前端「伏笔追踪」Tab(沉默≥5 标红「该回收了」)
- `rebuildTimelineAndCharacterStates` → `rebuildCharacterStates`(只角色状态)

**修改文件**:core(`models/memory`、`memory/aggregator`、`memory/context-builder`、`memory/index`、`storage/path`、`storage/summary-storage`、`storage/index`)+ studio(`services/summary-service`、`services/workspace-service`、`services/chat-service`、`routes/memory`、`server`、`pages/memory`)+ 3 个 test 文件

**验收**:core **231 passed**;studio tsc 通过;`GET /memory/timeline` **404**;`GET /memory/hooks-tracking` 返回 3 伏笔(均沉默≥5);`character-states` 7 实体保留。

## 特性记录:伏笔/实体建议状态变更 + 操作日志(2026-06-24)

**背景**:伏笔追踪不再提醒「该回收了」(只标埋设章 + 推进轨迹);伏笔可由作者标记完成/重新激活;实体建议除加入外可放弃;所有状态变更(完成/激活/加入/放弃)留痕可追溯。记录用统一 `memory/action-log.json`(文件方案,SQLite 缓存层留 G05-S08)。

**实现**:
- core:`ActionLogEntry`/`ActionLog` 类型 + `actionLogFilePath` + `SummaryStorage.appendActionLog`/`getActionLog`
- studio:`summary-service` 加 `setHookAction`(resolve/reactivate,复用 knowledge `updateHook`)、`acceptCuration`(封装写库+移除+记录)、`dismissCuration`(移除+记录)、`getActionLog`
- routes/memory:加 `GET /action-log`、`POST /hooks/:name/action`、`POST /curation/accept`、`POST /curation/dismiss`
- 前端:伏笔追踪删「该回收了」标红、加「标记完成/重新激活」按钮;实体建议加「放弃」按钮(加入改用 accept 封装);新增「操作记录」Tab 展示 action-log

**修改文件**:core(`models/memory`、`storage/path`、`storage/summary-storage`)+ studio(`services/summary-service`、`routes/memory`、`pages/memory`)

**验收**:core 231 passed;tsc 通过;实测「机械义肢的秘密」resolve → resolved、「林深」dismiss → 移除;`GET /memory/action-log` 记录 2 条(hook_resolve + curation_dismiss)。

## Parent Goal

- G04 — Phase 4:多模型 + 高级特性
