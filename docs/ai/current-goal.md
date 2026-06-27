# Current Goal

> **状态:G06(Phase 6 打磨)已完成,merge 到 main。用户目标(完成到 G06 含 G06)已达成;下一步为 Phase 7(G07 生产化),待用户决定。**

## 上一目标

G06 — Phase 6:打磨(2026-06-24)。视觉基础(衬线标题 + 纸张纹理 + 深色模式切换 + 全局动效 + 响应式)+ 顶栏快捷操作条(构思/续写/审稿)+ ErrorBoundary 错误处理。S06 性能标注(当前规模无明显瓶颈)。`core 288 + studio 140` 测试全绿。详见 `change-log.md` 2026-06-24 G06 条目。

## 下一目标(待选)

**G07 — Phase 7:生产化**(发布就绪,超出当前目标范围)。候选子目标:

- G07-S01 完善测试覆盖
- G07-S02 用户文档
- G07-S03 npm 发布
- G07-S04 CI/CD

> 用户目标(完成到 G06)已达成。G07 为发布就绪阶段,待用户决定是否启动。

## 特性记录:多书支持(书架 + 一次打开一本,2026-06-27)

**背景**:原为严格单书架构 —— 所有数据落在单一 projectRoot(packages/studio/)的一个 `novel.yaml` + volumes/knowledge/memory;`BookService.create` 在 `bookStorage.exists()` 时抛 `BOOK_ALREADY_EXISTS`,系统拒绝第二本(`book.test.ts` 还固化此行为)。用户需同时创作多本书。

**方案**:书架模式(方案 A,一次打开一本,类似 Obsidian vault)。每本书 = 家目录 `~/.storyweaver/books/<slug>/` 下的独立目录(= 该书的 projectRoot)。storage 层已 `projectRoot` 参数化,故"一本书一个目录"在数据层零改动;核心杠杆是 **`createServer`(单书 app)不变**,在其上加调度层 `library-server.ts`(front app 委托给"当前书"的 app,切书 = 停旧 FileWatcher + 重建 createServer + 启新 watcher)。切书非瞬时(后端重建 + 前端整页 reload),这是"一次一本"的取舍;不做多书同时在线。

**实现**:
- core:`storage/path.ts` 加 `libraryDir`/`bookDir`/`currentBookFilePath`;`storage/library-storage.ts`(列书/新建/slug 去重/读写 `.current-book` 指针);`models/library.ts`(`BookshelfItem`)
- studio 后端:`api/library-server.ts`(调度层 front + `switchBook`/`restoreActive`/`dispose`);`api/services/library-service.ts`;`api/routes/library.ts`(`GET /library`、`POST /library`、`POST /library/:slug/activate`);`api/migrate.ts`(首次迁移:复制单书数据→书架第一本,排除 `.cache`,源保留备份);`api/start.ts`(libraryRoot + 迁移 + restoreActive + serve)。**`server.ts`/`createServer` 零改动**,故 10 个单书测试与 `POST /book` 兼容保留
- studio 前端:`stores/library-store.ts`;`pages/library.tsx`(书架卡片网格 + 新建 + 空架引导);`components/layout/sidebar.tsx`(logo 下"当前书"入口);`pages/dashboard.tsx`(无书→引导书架);`App.tsx`(`/library` 路由)。朱批墨韵:宋体书名 + 朱砂分隔/印章(`Seal`)+ `vermilion` 按钮

**修改文件**:core(`storage/path`、`storage/library-storage`🆕、`storage/index`、`models/library`🆕、`models/index`、`storage/__tests__/library-storage.test`🆕)+ studio(`api/library-server`🆕、`api/services/library-service`🆕、`api/routes/library`🆕、`api/migrate`🆕、`api/start`、`api/__tests__/library.test`🆕、`stores/library-store`🆕、`pages/library`🆕、`components/layout/sidebar`、`pages/dashboard`、`App`)

**验收**:core **297 passed**;studio **148 passed**(19 文件);tsc 通过。实跑:首次启动自动迁移"示例小说·星河边缘"→`~/.storyweaver/books/bk-mcgxwb`(含 6 章 + 知识库 + 摘要,fileWatcher 索引 19 文档);新建第二本自动切换、`GET /book` 跟随新书;`activate` 切回第一本后 `GET /chapters` 返回 6 章(id 1/2/8/11/12/13),内容完整;`GET /library` 的 `current` 指针正确。

## 特性记录:书籍信息编辑 + 作者字段(2026-06-27)

**背景**:多书落地后发现书籍元信息无编辑入口 —— `PUT /book` 后端支持 title/genre/language/status 但前端 `updateBook` 无人调用;且 `Book` 模型无 `author` 字段。

**实现**:
- core:`Book` 加 `author?: string`(可选,兼容已有 novel.yaml);`BookshelfItem` 透传 author
- 后端:`createBookSchema`/`updateBookSchema` 加 author 可选;`BookService`/`LibraryService` 的 create 与 `BookService.update` 透传 author
- 前端:`dashboard` 扉页加「编辑」按钮 → 弹窗(书名/作者/类型/语言/状态)+ 作者副标题;书架新建表单加作者;书卡显示作者。保存经 `PUT /book`,无需重载

**修改文件**:core(`models/book`、`models/library`、`storage/library-storage`)+ studio(`api/schemas`、`api/services/book-service`、`api/services/library-service`、`stores/book-store`、`stores/library-store`、`pages/dashboard`、`pages/library`)

**验收**:core 297 + studio 148 测试绿、tsc 通过;curl `PUT /book {author}` 持久化进 `novel.yaml`、清空生效。

## 特性记录:书架卡片编辑/删除(2026-06-27)

**背景**:编辑入口原仅在 dashboard 扉页(当前书);书架需直接对**任意书**编辑 + 删除。

**实现**:
- core:`LibraryStorage` 加 `updateBookMeta(slug,patch)`(合并 + 刷新 updatedAt + 持久化)与 `deleteBook(slug)`(rm 目录,带校验)。
- 后端:`LibraryService` 加同名方法;`library-server` 加 `deleteBook` 协调(**删当前书** → `switchBook` 切到另一本,或书架空时清空 active + 指针);`library route` 加 `PUT /library/:slug`(按 slug 编辑,不依赖当前打开的书)与 `DELETE /library/:slug`。
- 前端:提取共享 `BookEditDialog`(dashboard 编辑当前书、书架编辑任意书复用,提交语义由 onSubmit 决定);书架 `BookCard` 右上角加编辑(✎)/删除(🗑)按钮(hover 显,`stopPropagation` 不触发卡片打开),当前书印章「阅」移至 eyebrow;`library-store` 加 `updateBook`/`deleteBook`(操作后刷新列表);dashboard 复用共享弹窗。删除前 `confirm` 提示不可恢复。

**修改文件**:core(`storage/library-storage`、`storage/__tests__/library-storage.test`)+ studio(`api/services/library-service`、`api/library-server`、`api/routes/library`、`api/__tests__/library.test`、`stores/library-store`、`components/book-edit-dialog`🆕、`pages/library`、`pages/dashboard`)

**验收**:core 301 + studio 152 测试绿、tsc 通过;curl 验证 `PUT /library/:slug` 改名/状态生效、`DELETE` 删当前书自动 fallback 到另一本(`GET /book` 拿到 fallback)、列表正确刷新、测试书清理后星河边缘恢复为 current。

## 特性记录:导出移至书架 + Dashboard 瘦身(2026-06-27)

**背景**:编辑/导出统一归到书架(对单本书的操作),dashboard 回归"当前书概览"纯展示。

**实现**:
- 后端:`library route` 加 `GET /library/:slug/export?format=txt|md`(为该书目录临时构建 `ChapterService`/`ExportService` 导出,不依赖当前打开的书)。
- 前端:书架 `BookCard` 底部常显 TXT/MD 导出小按钮(文件名用书名);`dashboard` 移除编辑按钮与导出按钮,变为纯展示扉页 + 统计。

**修改文件**:studio(`api/routes/library`、`api/__tests__/library.test`、`pages/library`、`pages/dashboard`)

**验收**:studio 153 测试绿、tsc 通过;curl 导出星河边缘 md/txt 返回 200 + 6 章标题、不存在书 404。

## 特性记录:Dashboard 统计增强(2026-06-27)

**背景**:Dashboard 原仅展示卷数/章节数/总字数/状态,信息量不足。

**实现**:
- 后端:`StatsService` 返回 `avgWords`/`maxWords`/`minWords`/`lastUpdatedAt`;**字数指标(总/平均/最长/最短)只统计已发布章节**(草稿空章不计入,避免拉低),章节状态分布与 lastUpdatedAt 仍覆盖所有章节。
- 前端:dashboard 分「篇幅 / 进度 / 节奏」三节展示 —— 扉页"始于 X · 已创作 N 天 · 更新 Y"副行;篇幅(已发布字数/章节总数/平均字数/最长·最短)、进度(卷数/草稿/审阅中/已发布)、节奏(创作天数/日均字数/最近写作)。创作天数/日均/相对时间前端计算;**无"完成度"**(系统无计划总章节数,算不出真正的完成度)。

**修改文件**:studio(`api/services/stats-service`、`pages/dashboard`)

**验收**:tsc 通过;curl `/stats` 字数只含已发布(totalWords 6212 / avgWords 1553 / maxWords 2623 / minWords 504),章节分布仍 total 6;`/book` 含 createdAt/updatedAt。

## 特性记录:写作活跃热力图(2026-06-27)

**背景**:书架页需展示写作活跃度(GitHub contribution 风格)。系统无逐日字数日志,采用近似口径。

**实现**:
- 后端:`LibraryService.getActivity(days)` 遍历书架所有书,每章字数归到其 `updatedAt` 那天,按天聚合,返回近 N 天(含 0)序列;`library route` 加 `GET /library/activity?days=`。
- 前端:`ActivityGraph` 组件(GitHub 风格热力图:周列 × 7 行,朱砂 5 级色阶,月份标签 + 图例 + 悬浮显示日期字数);书架页"我的作品"标题下渲染;`library-store` 加 `activity`/`fetchActivity`(删除书后刷新)。

**口径**:近似——每章字数归到其最后更新日(多天写的章节归一天),反映写作活动集中度而非精确每日增量。精确每日增量需新增写作日志(后续)。注:活跃图统计所有章节字数(含 draft 写作活动),与 Dashboard「篇幅」只统计已发布不同——两者口径各异但各自合理。

**修改文件**:studio(`api/services/library-service`、`api/routes/library`、`stores/library-store`、`components/activity-graph`🆕、`pages/library`、`api/__tests__/stats-service.test` 口径调整)

**验收**:tsc + studio 153 测试绿;curl `/library/activity?days=120` 返回 120 天,有写作日(06-16 · 6212、06-25 · 3847)。

## 特性记录:伏笔追踪替换时间线(/memory 页,2026-06-24)

**背景**:时间线对复杂叙事(回忆/穿越/多世界)是错误抽象 —— `narrativeTime` 提取不准(第2章把回溯时间全塞进来),且与章节摘要内容重复。改用「伏笔追踪」:按**章节序**(不受叙事时间结构影响)+ 驱动 AI 写作的伏笔注入,零增量维护。

**实现**:
- 删 timeline 全链:core 类型(`Timeline`/`TimelineItem`)、`aggregateTimeline`、`saveTimeline`/`getTimeline`、`timelineFilePath`、`GET /memory/timeline`、前端时间线 Tab;`context-builder` Layer3 兜底改用 `characterStates`
- 新增伏笔追踪:core `aggregateHooksTracking`(Hook 实体 + 章节摘要 `hooksPlanted`/`hooksAdvanced` 确定性聚合 → `HookTracking`:状态/埋设章/最近推进/沉默章数/轨迹)+ `GET /memory/hooks-tracking` + 前端「伏笔追踪」Tab(沉默≥5 标红「该回收了」)
- `rebuildTimelineAndCharacterStates` → `rebuildCharacterStates`(只角色状态)

**修改文件**:core(`models/memory`、`memory/aggregator`、`memory/context-builder`、`memory/index`、`storage/path`、`storage/summary-storage`、`storage/index`)+ studio(`services/summary-service`、`services/workspace-service`、`services/chat-service`、`routes/memory`、`server`、`pages/memory`)+ 3 个 test 文件

**验收**:core **231 passed**;studio tsc 通过;`GET /memory/timeline` **404**;`GET /memory/hooks-tracking` 返回 3 伏笔(均沉默≥5);`character-states` 7 实体保留。

## 特性记录:伏笔/实体建议状态变更 + 操作日志(2026-06-24)

**背景**:伏笔追踪不再提醒「该回收了」(只标埋设章 + 推进轨迹);伏笔可由作者标记完成/重新激活;实体建议除加入外可放弃;所有状态变更(完成/激活/加入/放弃)留痕可追溯。记录用统一 `memory/action-log.json`(文件方案,SQLite 缓存层见 G04(已提升为独立阶段))。

**实现**:
- core:`ActionLogEntry`/`ActionLog` 类型 + `actionLogFilePath` + `SummaryStorage.appendActionLog`/`getActionLog`
- studio:`summary-service` 加 `setHookAction`(resolve/reactivate,复用 knowledge `updateHook`)、`acceptCuration`(封装写库+移除+记录)、`dismissCuration`(移除+记录)、`getActionLog`
- routes/memory:加 `GET /action-log`、`POST /hooks/:name/action`、`POST /curation/accept`、`POST /curation/dismiss`
- 前端:伏笔追踪删「该回收了」标红、加「标记完成/重新激活」按钮;实体建议加「放弃」按钮(加入改用 accept 封装);新增「操作记录」Tab 展示 action-log

**修改文件**:core(`models/memory`、`storage/path`、`storage/summary-storage`)+ studio(`services/summary-service`、`routes/memory`、`pages/memory`)

**验收**:core 231 passed;tsc 通过;实测「机械义肢的秘密」resolve → resolved、「林深」dismiss → 移除;`GET /memory/action-log` 记录 2 条(hook_resolve + curation_dismiss)。

## Parent Goal

- G07 — Phase 7:生产化
