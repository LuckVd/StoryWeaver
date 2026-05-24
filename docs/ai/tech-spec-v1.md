# AI 辅助小说创作系统 — 完整技术方案文档

> 技术栈：TypeScript + Node.js + React + Hono
> 版本：v1.0
> 日期：2026-05-22
> 设计原则：人主导，AI 辅助 | 纯本地部署 | 对话式交互

---

## 1. 系统概述

### 1.1 愿景

构建一套 **个人 AI 辅助小说创作系统**，通过多 Agent 协作实现"构思 → 写作 → 审稿 → 修订"全流程辅助，同时保留人工审核门控，让创作者始终掌控全局。

### 1.2 核心设计原则

| 原则 | 说明 |
|---|---|
| **人主导，AI 辅助** | 所有 AI 操作由人手动触发，AI 不自动执行任何写作/审稿/修订 |
| **纯本地部署** | 所有数据存储在本地文件系统，零云依赖 |
| **对话式交互** | 通过自然语言对话给 AI 下指令，灵活控制写作粒度 |
| **状态锁定** | 已发布（定稿）的章节不可修改，情节固化成为"事实" |
| **工作区机制** | 每次发布后创作新章节在独立工作区内进行 |

### 1.3 核心能力

| 能力 | 说明 |
|---|---|
| 大纲规划 | AI 辅助构思全书大纲、角色设计、世界观搭建 |
| 自动写作 | 对话式 AI 续写，灵活粒度（一段/一场景/一章） |
| 调整改写 | AI 根据指令调整工作区内的内容 |
| 连贯性审稿 | AI 多维度审查（人设、时间线、伏笔、风格） |
| 智能修订 | AI 根据审稿意见修改 |
| 知识库 | 结构化管理角色/世界观/物品/伏笔/规则，AI 和人都可维护 |
| 长篇记忆 | 三层记忆系统解决百万字上下文问题 |
| 人工门控 | 定稿/发布由人确认，关键节点人工把控 |
| 多模型适配 | 支持 OpenAI / Claude / 本地模型灵活切换 |

### 1.4 目标用户

个人网文作者，主要写百万字级长篇连载（玄幻/仙侠/都市等）。

### 1.5 启动方式

**开发环境：**
```bash
pnpm dev                          # Vite dev server + Hono，热更新
```

**生产/用户使用：**
```bash
npx ai-novel --open               # 构建后启动，自动打开浏览器
npx ai-novel --port 3000          # 指定端口
```

启动时自动完成：
1. 读取项目目录（默认 cwd，可通过 `--project` 指定）
2. 解析 `novel.yaml` 加载项目配置
3. 构建内存索引（扫描 volumes/ 和 knowledge/）
4. 启动 FileWatcher 监听文件变更
5. 启动 Hono HTTP Server
6. 打开浏览器

### 1.6 项目元信息 (novel.yaml)

```yaml
title: "修仙大世界"
genre: "玄幻"
language: "zh"
createdAt: "2026-05-22T10:00:00Z"
updatedAt: "2026-06-15T18:30:00Z"

# 章节 ID 管理
nextChapterId: 36

# 模型配置
defaultModel: "gpt-4o"
agentOverrides:
  writer: "claude-3.5-sonnet"
  summarizer: "gpt-4o-mini"
```

---

## 2. 核心概念与领域模型

### 2.1 实体关系图

```
┌─────────────────────────────────────────────────────────────┐
│                        书籍 (Book)                          │
│  title, genre, lang, status, createdAt                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐               │
│  │  卷 Vol.1 │   │  卷 Vol.2 │   │  卷 Vol.3 │  ...         │
│  └────┬─────┘   └────┬─────┘   └──────────┘               │
│       │               │                                     │
│  ┌────▼────────────────▼─────────────────┐                  │
│  │  章节 (Chapter)                        │                  │
│  │  id(自增), title, content, wordCount   │                  │
│  │  status: draft | approved | published  │                  │
│  │  publishedAt (锁定时间戳)               │                  │
│  └───────────────────────────────────────┘                  │
│                                                             │
│  ┌───────────────────────────────┐                          │
│  │       工作区 (Workspace)       │                          │
│  │  一批待创作/待发布的章节集合     │                          │
│  │  发布后已发布章节移出，继续复用  │                          │
│  │  系统全局唯一工作区              │                          │
│  └───────────────────────────────┘                          │
│                                                             │
│  ┌──────────────────────────────────────────────┐           │
│  │              知识库 (Knowledge Base)           │           │
│  │  人工维护为主，AI 辅助维护                      │           │
│  │                                               │           │
│  │  📁 角色 (Characters)                          │           │
│  │     角色档案 + 关系图（邻接表） + 状态变迁日志   │           │
│  │  📁 世界观 (World)                             │           │
│  │     地理 | 力量体系 | 势力/阵营 | 历史 | 术语表   │           │
│  │  📁 物品 (Items)                               │           │
│  │     物品档案 + 归属关系                          │           │
│  │  📁 大纲 (Outline)                             │           │
│  │     全书 > 卷 > 章节                            │           │
│  │  📁 伏笔 (Hooks)                               │           │
│  │     状态(active/resolved) + 关联实体              │           │
│  │  📁 写作规则 (Rules)                            │           │
│  │     风格约束 | 禁忌 | 叙事视角                    │           │
│  │  📁 自定义 (Custom)                             │           │
│  │     用户任意分类                                  │           │
│  │  📁 时间线 (Timeline) ← AI 维护                  │           │
│  │     客观事件序列                                  │           │
│  └──────────────────────────────────────────────┘           │
│                                                             │
│  ┌──────────────────────────────────────────────┐           │
│  │           AI 记忆库 (Memory Store)            │           │
│  │  AI 自动维护，发布时生成/更新                    │           │
│  │                                               │           │
│  │  章节摘要 | 多章综合总结 | 角色状态快照           │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 关键概念定义

| 概念 | 定义 |
|---|---|
| **书籍 (Book)** | 顶层容器，一本小说的所有数据 |
| **卷 (Volume)** | 书籍下的分卷，作为大纲的一部分管理 |
| **章节 (Chapter)** | 最小创作单元，自增数字 ID |
| **工作区 (Workspace)** | 唯一的工作区，包含待创作/待发布的章节。发布后已发布章节移出，继续复用 |
| **知识库 (Knowledge Base)** | 人工维护的设定资料，AI 可辅助维护（需人工确认） |
| **AI 记忆库 (Memory Store)** | AI 可查询的结构化记忆，发布时自动生成/更新 |

### 2.3 关系图存储（邻接表）

```typescript
interface RelationEdge {
  id: string;
  from: string;           // 实体 ID
  to: string;             // 实体 ID
  type: string;           // 关系类型（师徒/宿敌/暗恋/同门...）
  direction: 'mutual' | 'directed';  // 双向还是单向
  since?: string;         // 从哪章开始
  note?: string;          // 补充说明
}
```

### 2.4 知识库维护分工

| 内容 | 谁维护 | 说明 |
|---|---|---|
| 角色档案 / 世界观 / 物品 / 大纲 / 伏笔 / 规则 / 自定义 | **人工** | AI 可辅助建议，需人工确认 |
| 角色状态变迁日志 | **AI 维护** | 发布时自动生成/更新，人工可修正 |
| 时间线 | **AI 维护** | 发布时自动生成/更新，人工可修正 |

### 2.5 状态流转

**章节状态：**

```
draft ──(人工编辑 / AI写作)──→ draft (内容更新)
  │
  ├──(人工触发审稿)──→ 生成审稿报告
  │                      │
  │              ┌───────▼────────┐
  │              │ 人查看审稿报告  │
  │              └───┬────────┬───┘
  │                  │        │
  │            人工修改    触发AI修订
  │                  │        │
  │                  └────┬───┘
  │                       │ (可再次审稿)
  │                       ▼
  ├──(人工确认定稿)──→ approved
  │
  └──(随发布锁定)──→ published (不可改)
```

**工作区状态：**

```
active (唯一工作区，永远复用)
  → 选择部分/全部 approved 章节发布
  → 发布的章节锁定为 published，移出工作区
  → 未发布的章节保留在工作区
  → 继续创作...
```

---

## 3. 核心工作流

### 3.1 完整工作流

```
1. 创建书籍 → 设置基础信息（书名/类型/语言）

2. 初始化知识库 → 角色/世界观/大纲/规则

3. 进入工作区 → 创作章节
   │
   │  写作方式（对话式交互，所有操作人工触发）：
   │  ├── 人工直接写
   │  ├── 对话指令让 AI 续写（灵活粒度：一段/一场景/一章）
   │  ├── 对话指令让 AI 调整/改写（仅工作区内容）
   │  └── 混合模式自由切换
   │
   │  审稿（手动触发）：
   │  └── AI 多维度审查 → 人查看报告 → 人工改 / 触发 AI 修订
   │
   │  定稿（手动确认）：
   │  └── approved 状态
   │
4. 发布（手动触发）
   ├── 选择要发布的 approved 章节
   ├── 章节锁定 → published（不可改）
   └── AI 自动总结更新：
       ├── 章节摘要
       ├── 时间线更新
       ├── 角色状态变迁
       ├── 伏笔状态更新
       └── 综合剧情总结

5. 工作区保留未发布章节 → 继续创作
```

### 3.2 对话式写作交互

用户在编辑器右侧的对话面板中，像聊天一样给 AI 下指令：

```
用户: "续写下一个场景，张三进入密室发现了一个古老的阵法，大约 500 字"
AI:  [流式生成 500 字内容]
     [✅ 应用到章节] ← 用户点击将内容追加到章节

用户: "把第三段对话改得更紧张一些"
AI:  [修改指定段落]
     [✅ 应用到章节] ← 用户点击替换原内容

用户: "继续写，张三破解阵法，过程详细一点，2000 字"
AI:  [流式生成 2000 字续写]
```

### 3.3 AI 操作触发规则

| 操作 | 谁触发 | AI 是否自动执行 |
|---|---|---|
| 续写 | 人 | ❌ 人发对话指令 |
| 改写 | 人 | ❌ 人发对话指令 |
| 审稿 | 人 | ❌ 人点"审稿"按钮 |
| 修订 | 人 | ❌ 人触发 AI 修订 |
| 构思 | 人 | ❌ 人发对话指令 |
| 发布总结 | 系统 | ✅ 发布时自动执行 |
| 知识库辅助 | 人 | ❌ 人发对话指令，结果需人确认 |

---

## 4. 数据架构

### 4.1 存储方案

**纯文件存储（Single Source of Truth），后期可选加 SQLite 缓存层。**

| 设计决策 | 说明 |
|---|---|
| **文件为唯一数据源** | 所有数据存在文件中（JSON + Markdown） |
| **启动时构建内存索引** | 全文搜索等需求通过内存倒排索引满足 |
| **后期可加 SQLite 缓存** | 纯缓存层，可随时删除重建，不影响数据完整性 |
| **接口预留** | 数据访问层抽象为接口，底层实现可替换 |

### 4.2 项目文件夹结构

```
my-novel/
├── novel.yaml                    # 项目元信息（书名/类型/语言/创建时间）
│
├── config/                       # 项目配置
│   └── prompts/                  # 自定义 Prompt 模板（不存在 = 用默认）
│       ├── writer.md
│       ├── auditor.md
│       └── ...
│
├── knowledge/                    # 知识库（结构化 JSON）
│   ├── characters/               # 角色
│   │   ├── _index.json           # 角色列表 + 基础信息
│   │   ├── zhang-san.json        # 角色详细档案
│   │   └── li-si.json
│   ├── world/                    # 世界观
│   │   ├── geography.json        # 地理
│   │   ├── power-system.json     # 力量体系
│   │   ├── factions.json         # 势力/阵营（图存储）
│   │   ├── history.json          # 历史事件
│   │   └── glossary.json         # 术语表
│   ├── items.json                # 物品
│   ├── outline.json              # 大纲（全书 > 卷 > 章）
│   ├── hooks.json                # 伏笔
│   ├── rules.json                # 写作规则
│   ├── relations.json            # 关系图（所有实体间的边，邻接表）
│   └── custom/                   # 自定义分类
│       └── *.json
│
├── volumes/                      # 章节正文
│   ├── v01/
│   │   ├── ch001.md              # 章节正文（Markdown）
│   │   ├── ch002.md
│   │   └── ...
│   └── v02/
│       └── ...
│
├── memory/                       # AI 记忆库（AI 维护）
│   ├── summaries/                # 章节摘要
│   │   ├── v01-ch001.json
│   │   └── ...
│   ├── story-state.json           # Layer 1 剧情状态快照
│   ├── timeline.json             # 时间线
│   ├── character-states.json     # 角色状态变迁
│   └── batch-summaries/          # 多章综合总结
│       ├── batch-001.json
│       └── ...
│
├── workspace/                    # 工作区元数据
│   └── current.json              # 当前工作区状态
│
├── reviews/                      # 审稿记录
│   ├── ch031-review-001.json
│   └── ...
│
├── chat/                         # 对话历史
│   ├── sessions.json             # session 列表
│   └── session-xxx.json          # 对话记录
│
└── .cache/                       # 缓存（可删除重建）
    └── novel.db                  # SQLite 缓存（后期可选）
```

### 4.3 存储分工

| 数据类型 | 格式 | 原因 |
|---|---|---|
| 章节正文 | Markdown 文件 | 人可直接阅读/编辑 |
| 知识库 | JSON 文件 | 结构化、前端直接渲染、AI 直接解析 |
| 关系图 | JSON（邻接表） | 灵活、前端可渲染成可视化图 |
| AI 记忆 | JSON 文件 | 结构化摘要 |
| 审稿记录 | JSON 文件 | 每次审稿独立记录 |
| 对话历史 | JSON 文件 | 按 session 存储 |

### 4.4 内存索引设计

```typescript
interface SearchEngine {
  search(query: string): SearchResult[];
  indexChapter(chapter: Chapter): void;
  indexFile(filePath: string): void;
  reindexFile(filePath: string): void;
  removeFile(filePath: string): void;
  rebuild(): Promise<void>;
}

// Phase 1: 内存实现
class InMemorySearchEngine implements SearchEngine {
  private wordIndex: Map<string, Set<number>> = new Map();  // 倒排索引
  private characterIndex: Map<string, Set<number>> = new Map();

  async rebuild() {
    // 启动时扫描所有章节文件，分词后建索引
    // 百万字约 1-2 秒
  }

  search(query: string): SearchResult[] {
    // 查 Map，微秒级响应
  }
}

// Phase 3（可选）: SQLite 缓存实现（无缝替换）
class SQLiteSearchEngine implements SearchEngine { ... }
```

### 4.5 章节版本控制

| 规则 | 说明 |
|---|---|
| **最大版本数** | 每章最多保留 100 个版本快照 |
| **创建时机** | AI apply 前、用户保存时、状态变更时 |
| **AI 可读** | Agent 可查看历史版本进行对比分析 |
| **人工回退** | 支持选择任意版本回退 |
| **发布清除** | 章节发布 (published) 后清除其所有历史版本 |
| **超出限制** | 未发布时超过 100 个则自动删除最旧版本 |
| **编辑中 undo** | 由 Tiptap 编辑器内置 undo/redo 处理（内存中） |

```typescript
interface ChapterVersion {
  id: number;                     // 版本号（自增）
  chapterId: number;
  content: string;                // 完整内容快照
  trigger: 'save' | 'ai_apply' | 'status_change';
  description?: string;           // "AI 续写了密室场景" / "状态变更为 approved"
  wordCount: number;
  createdAt: Date;
}
```

存储位置：

```
volumes/v01/
├── ch031.md                      # 当前最新内容
└── ch031.versions/               # 版本历史（发布后此目录清空）
    ├── v001.json
    ├── v002.json
    └── ...
```

### 4.6 文件监听 (File Watcher)

由于数据纯文件存储 + 内存索引，需要监听文件系统变化以应对用户在外部编辑器（VS Code 等）中直接修改文件的情况：

```typescript
import { watch } from 'chokidar';

class FileWatcher {
  private watcher: FSWatcher;

  start(projectRoot: string, searchEngine: SearchEngine) {
    this.watcher = watch([
      `${projectRoot}/volumes/**/*.md`,
      `${projectRoot}/knowledge/**/*.json`,
    ], { ignoreInitial: true });

    this.watcher.on('change', (filePath) => {
      searchEngine.reindexFile(filePath);
      sseEmitter.emit('file:changed', { path: filePath });
    });

    this.watcher.on('add', (filePath) => {
      searchEngine.indexFile(filePath);
      sseEmitter.emit('file:added', { path: filePath });
    });

    this.watcher.on('unlink', (filePath) => {
      searchEngine.removeFile(filePath);
      sseEmitter.emit('file:removed', { path: filePath });
    });
  }
}
```

---

## 5. AI 记忆系统

### 5.1 核心挑战

```
百万字小说 ≈ 100万+ tokens
主流模型上下文窗口 ≈ 12.8万~200万 tokens
每次请求不可能塞入全文
→ 必须选择性注入最相关的信息
```

### 5.2 三层记忆架构

```
┌─────────────────────────────────────────────┐
│  Layer 1: 永久记忆（始终注入）               │
│  ≈ 2000-5000 tokens                         │
│                                              │
│  - 核心角色设定（主角+关键配角）              │
│  - 世界观核心规则                            │
│  - 写作规则/禁忌                             │
│  - 当前剧情状态快照（最新的"故事在哪了"）     │
│                                              │
│  特点：每次 AI 操作都带上，内容精简           │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│  Layer 2: 近期记忆（最近几章的详细内容）       │
│  ≈ 3000-8000 tokens                         │
│                                              │
│  - 最近 3-5 章的完整文本或详细摘要            │
│  - 当前工作区所有草稿                        │
│                                              │
│  特点：保证与前文的直接连贯性                 │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│  Layer 3: 远期记忆（按需检索）               │
│  ≈ 1000-4000 tokens（动态）                 │
│                                              │
│  来源：                                      │
│  ├── 章节摘要（每章 200-300 字压缩摘要）      │
│  ├── 多章综合总结（每 10-20 章一个综合总结）   │
│  ├── 时间线中相关事件                        │
│  ├── 角色状态变迁中相关条目                   │
│  └── 伏笔记录中 active 的伏笔                │
│                                              │
│  检索策略：                                   │
│  ├── 关键词匹配（当前章节涉及的角色/地点）     │
│  ├── 伏笔驱动（沉默太久的伏笔优先）           │
│  ├── 大纲指引（大纲中指定的回顾内容）          │
│  └── 综合总结兜底（最近的 BatchSummary）       │
│                                              │
│  特点：只取需要的，token 可控                 │
└─────────────────────────────────────────────┘
```

**Layer 1 剧情状态快照格式（存储于 memory/story-state.json）：**

```typescript
interface StoryStateSnapshot {
  lastPublishedChapter: number;       // 最后发布的章节号
  currentArc: string;                 // 当前故事弧概述（100字以内）
  activeCharacters: string[];         // 当前活跃角色列表
  currentLocation: string;            // 故事当前发生地
  recentEvents: string[];             // 最近 3-5 个关键事件（每条 20 字以内）
  openQuestions: string[];            // 当前悬而未决的问题
  updatedAt: Date;                    // 发布时 Summarizer 生成/更新
}
```

### 5.3 章节摘要结构

每章发布后，AI 生成结构化摘要：

```typescript
interface ChapterSummary {
  chapter: number;
  volume: number;
  title: string;

  plotEvents: string[];           // ["张三进入密室", "发现古阵法", "触发机关受伤"]
  plotOutcome: string;            // 一句话结果

  charactersPresent: string[];    // 出场角色
  characterActions: Record<string, string>;  // { "张三": "破解阵法" }

  newRevealedInfo: string[];      // 本章新揭示的信息
  locationsUsed: string[];        // 涉及地点

  hooksAdvanced: string[];        // 推进了哪些伏笔
  hooksPlanted: string[];         // 新埋了哪些伏笔

  stateChanges: StateChange[];    // [{ entity: "张三", field: "修为", from: "金丹", to: "元婴" }]

  narrativeTime?: string;         // 故事内时间
  wordCount: number;
}
```

### 5.4 多章综合总结

每 10 章（可在 novel.yaml 中配置 `batchSummaryInterval`）生成一次：

```typescript
interface BatchSummary {
  chapterRange: [number, number];  // [21, 30]
  volume: number;
  narrativeArc: string;            // 核心剧情线（500字以内）
  turningPoints: string[];         // 关键转折点
  characterDevelopment: Record<string, string>;  // 角色发展
  unresolvedThreads: string[];     // 未解决的问题
}
```

### 5.5 发布时的总结流程

```
发布章节 Ch.31-35
    │
    ├──→ 为每章生成摘要 (ChapterSummary)
    ├──→ 更新时间线
    ├──→ 更新角色状态变迁
    ├──→ 更新伏笔状态
    └──→ 生成综合总结（如果累计够 10-20 章）
```

### 5.6 检索策略

```
输入：当前要写什么（大纲 / 用户对话指令 / 工作区上下文）
  │
  ├─ 提取关键词：涉及的角色名、地点、物品
  ├─ 策略 1: 角色关联 → 搜索包含相关角色的章节摘要
  ├─ 策略 2: 伏笔驱动 → 扫描 active 伏笔，沉默太久的优先注入
  ├─ 策略 3: 大纲指引 → 大纲中指定本章需要回顾的内容
  └─ 策略 4: 综合总结兜底 → 注入最近 2-3 个 BatchSummary
```

### 5.7 Token 预算管理

```typescript
interface TokenBudget {
  total: number;           // 模型上下文窗口（如 128K）
  systemPrompt: number;    // Agent 角色定义 ~500
  layer1: number;          // 永久记忆 ~3000
  layer2: number;          // 近期记忆 ~6000
  layer3: number;          // 远期记忆（动态计算剩余空间）
  outputReserve: number;   // 留给 AI 输出 ~4000
}

function calcLayer3Budget(model: string, l1: number, l2: number, dialogHistory: number): number {
  const window = getModelContextWindow(model);
  const reserved = 500 + l1 + l2 + dialogHistory + 4000;
  return Math.floor((window - reserved) * 0.7);
}
```

### 5.8 对话上下文管理

最近 5 轮对话：完整保留
更早的对话：由 Summarizer Agent 压缩成摘要
触发条件：对话超过 10 轮（20 条消息）

**完整上下文组装顺序（每次 AI 调用）：**

```
1. System Prompt（Agent 角色定义）         ~500 tokens
2. Layer 1: 永久记忆（设定/规则/状态快照）  ~3000 tokens
3. Layer 2: 近期章节内容                    ~6000 tokens
4. Layer 3: 远期记忆（按需检索）            ~动态
5. 对话历史（压缩摘要 + 近期完整）           ~3500 tokens
6. 当前用户消息                             ~200 tokens
7. [留给 AI 输出的空间]                     ~4000 tokens
```

---

## 6. Agent 架构

### 6.1 Agent 清单

系统共 5 个 Agent + 1 个路由层：

- **Router** — 意图路由（规则优先 + LLM 兜底）
- **Brainstormer** — 构思 Agent（高温度，发散创意）
- **Writer** — 写作 Agent（续写/改写/修订，精准执行）
- **Auditor** — 审稿 Agent（多维度审查，严格低温度）
- **Summarizer** — 总结 Agent（章节摘要/时间线/角色状态/综合总结）
- **Curator** — 知识库 Agent（辅助整理设定，需人工确认）

### 6.2 Agent 合并理由

| Agent | 合并结果 | 理由 |
|---|---|---|
| 写作 + 改写 + 修订 | → **Writer** | 本质都是"根据指令生成/修改内容" |
| 审稿 | → **Auditor**（独立） | "批评者"视角，混合会导致 prompt 人格分裂 |
| 总结 + 时间线更新 | → **Summarizer** | 都是"发布后回顾分析" |
| 构思 | → **Brainstormer**（独立） | 需要发散思维、高温度 |
| 知识库辅助 | → **Curator**（独立） | 分析+结构化能力，结果需人确认 |

### 6.3 模型配置

```typescript
interface ModelConfig {
  id: string;                     // "gpt-4o"
  name: string;                   // 显示名
  service: string;                // "openai" | "anthropic" | "ollama" | ...
  apiKey: string;                 // 环境变量引用
  baseUrl?: string;               // 自定义 endpoint
  contextWindow?: number;         // 上下文窗口大小
}

interface AgentModelConfig {
  default: string;                // 默认模型
  overrides?: {                   // 单独覆盖
    brainstormer?: string;
    writer?: string;
    auditor?: string;
    summarizer?: string;
    curator?: string;
    router?: string;
  };
}
```

### 6.4 BaseAgent 设计

```typescript
export abstract class BaseAgent {
  protected client: LLMClient;
  protected config: AgentConfig;

  constructor(client: LLMClient, config: AgentConfig) {
    this.client = client;
    this.config = config;
  }

  protected async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    return this.client.chatCompletion(messages, {
      model: this.config.model,
      temperature: this.config.temperature ?? 0.7,
      ...options,
    });
  }

  protected async *chatStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    yield* this.client.chatCompletionStream(messages, { ...options });
  }

  protected async chatStructured<T>(
    messages: Message[],
    schema: ZodSchema<T>,
    maxRetries = 3
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      const raw = await this.chat(messages);
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      messages.push({
        role: 'user',
        content: `输出格式错误，请重新生成：${parsed.error.message}`
      });
    }
    throw new Error('Failed to get structured output');
  }
}
```

### 6.5 审稿维度

| 维度 | 检查内容 | 权重 |
|---|---|---|
| **人设一致性 (OOC)** | 角色性格、说话风格、行为逻辑 | 高 |
| **时间线连贯** | 事件顺序、时间跨度 | 高 |
| **世界观合规** | 是否违反已建立的规则/设定 | 高 |
| **伏笔管理** | 已埋伏笔是否合理推进 | 中 |
| **节奏控制** | 叙事节奏、张弛有度 | 中 |
| **风格一致** | 文风、叙事视角是否统一 | 中 |
| **篇幅控制** | 字数是否在目标范围内 | 低 |

### 6.6 路由策略

规则优先 + LLM 兜底：

```typescript
async function routeUserMessage(input: string, context: RoutingContext): Promise<AgentName> {
  const trimmed = input.trim();

  // 1. 斜杠命令（精确匹配）
  if (/^\/write/i.test(trimmed)) return 'writer';
  if (/^\/audit/i.test(trimmed)) return 'auditor';
  if (/^\/brainstorm/i.test(trimmed)) return 'brainstormer';

  // 2. 关键词规则（高频意图）
  if (/(续写|继续写|写下去|接着写|write|continue)/i.test(trimmed)) return 'writer';
  if (/(改写|修改|调整|rewrite|revise)/i.test(trimmed)) return 'writer';
  if (/(审稿|检查|审查|audit|review)/i.test(trimmed)) return 'auditor';
  if (/(构思|想想|设计|头脑风暴|brainstorm)/i.test(trimmed)) return 'brainstormer';
  if (/(角色|设定|知识库|世界观)/i.test(trimmed)) return 'curator';

  // 3. LLM 兜底
  return await classifyIntentWithLLM(trimmed, context);
}
```

### 6.7 Prompt 管理

每个 Agent 有默认 Prompt（代码内置），用户可在 `config/prompts/` 中覆盖。

```
Prompt 组装：
┌────────────────────────────────┐
│  System Prompt（可用户编辑）    │  ← Agent 角色定义
├────────────────────────────────┤
│  知识库上下文（自动注入）       │  ← 角色/世界观/规则
├────────────────────────────────┤
│  记忆上下文（自动注入）        │  ← 三层记忆
├────────────────────────────────┤
│  对话历史（自动注入）          │  ← 历史消息
├────────────────────────────────┤
│  用户消息                      │  ← 当前指令
└────────────────────────────────┘
```

---

## 7. 后端 API 设计

### 7.1 总体规范

| 规范 | 说明 |
|---|---|
| **框架** | Hono |
| **协议** | HTTP/1.1 + SSE |
| **格式** | JSON |
| **路由前缀** | `/api/v1` |
| **流式响应** | `text/event-stream` (SSE) |
| **错误格式** | `{ error: { code: string, message: string, details?: any } }` |

### 7.2 完整 API 端点

#### 书籍

```
POST   /api/v1/book
GET    /api/v1/book
PUT    /api/v1/book
```

#### 章节

```
GET    /api/v1/volumes
POST   /api/v1/volumes
PUT    /api/v1/volumes/:id
PUT    /api/v1/chapters/:id/move          Body: { targetVolume: 2 }

GET    /api/v1/chapters
POST   /api/v1/chapters
GET    /api/v1/chapters/:id
PUT    /api/v1/chapters/:id
DELETE /api/v1/chapters/:id               (仅 draft)
PUT    /api/v1/chapters/:id/status
GET    /api/v1/chapters/:id/versions
GET    /api/v1/chapters/:id/versions/:vid
POST   /api/v1/chapters/:id/versions/:vid/restore
```

#### 工作区 & 发布

```
GET    /api/v1/workspace
POST   /api/v1/workspace/publish          Body: { chapters: [31, 32, 33] } → SSE
```

#### 知识库

```
GET    /api/v1/knowledge
GET    /api/v1/knowledge/:category
POST   /api/v1/knowledge/:category
GET    /api/v1/knowledge/:category/:id
PUT    /api/v1/knowledge/:category/:id
DELETE /api/v1/knowledge/:category/:id

GET    /api/v1/knowledge/outline
PUT    /api/v1/knowledge/outline

GET    /api/v1/knowledge/relations
POST   /api/v1/knowledge/relations
PUT    /api/v1/knowledge/relations/:id
DELETE /api/v1/knowledge/relations/:id
```

category: `characters` | `world` | `items` | `hooks` | `rules` | `custom-*`

#### AI 对话

```
GET    /api/v1/chat/sessions
POST   /api/v1/chat/sessions
GET    /api/v1/chat/sessions/:id
DELETE /api/v1/chat/sessions/:id

POST   /api/v1/chat/sessions/:id/messages   → SSE
       Body: { message, context?: { chapterRef?, agentOverride? } }

POST   /api/v1/chat/sessions/:id/apply
       Body: { messageId, target, mode: "append"|"replace"|"insert", selection?, originalText?, position? }
```

#### 审稿

```
POST   /api/v1/chapters/:id/audit          → SSE
GET    /api/v1/chapters/:id/reviews
```

#### AI 记忆库

```
GET    /api/v1/memory/summaries
GET    /api/v1/memory/timeline
GET    /api/v1/memory/character-states
POST   /api/v1/memory/rebuild
```

#### 模型 & Agent 配置

```
GET    /api/v1/settings/models
POST   /api/v1/settings/models
PUT    /api/v1/settings/models/:id
DELETE /api/v1/settings/models/:id
POST   /api/v1/settings/models/:id/test

GET    /api/v1/settings/agents
PUT    /api/v1/settings/agents

GET    /api/v1/settings/prompts
GET    /api/v1/settings/prompts/:agent
PUT    /api/v1/settings/prompts/:agent
DELETE /api/v1/settings/prompts/:agent
```

#### 搜索 & 统计 & 导出

```
GET    /api/v1/search?q=...&scope=all
GET    /api/v1/analytics/:type
POST   /api/v1/export       Body: { format: "txt"|"epub"|"markdown" }
GET    /api/v1/events        全局 SSE 事件流
```

### 7.3 SSE 事件类型

```typescript
type SSEEvent =
  | { type: 'agent:start'; data: { agent: AgentName; stage: string } }
  | { type: 'agent:token'; data: { agent: AgentName; token: string } }
  | { type: 'agent:complete'; data: { agent: AgentName; result: any } }
  | { type: 'review:score'; data: { score: number; issues: Issue[] } }
  | { type: 'chapter:complete'; data: { chapterId: number; wordCount: number } }
  | { type: 'publish:progress'; data: { step: string; current: number; total: number } }
  | { type: 'publish:complete'; data: { chapters: number[] } }
  | { type: 'file:changed'; data: { path: string } }
  | { type: 'file:added'; data: { path: string } }
  | { type: 'file:removed'; data: { path: string } }
  | { type: 'error'; data: { message: string; recoverable: boolean } }
  | { type: 'truth:updated'; data: { file: string } };
```

### 7.4 错误码

```typescript
enum ErrorCode {
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CHAPTER_NOT_FOUND = 'CHAPTER_NOT_FOUND',
  CHAPTER_LOCKED = 'CHAPTER_LOCKED',
  CHAPTER_NOT_APPROVED = 'CHAPTER_NOT_APPROVED',
  LLM_CONNECTION_FAILED = 'LLM_CONNECTION_FAILED',
  LLM_RATE_LIMITED = 'LLM_RATE_LIMITED',
  LLM_CONTEXT_OVERFLOW = 'LLM_CONTEXT_OVERFLOW',
  LLM_INVALID_RESPONSE = 'LLM_INVALID_RESPONSE',
  KNOWLEDGE_CATEGORY_NOT_FOUND = 'KNOWLEDGE_CATEGORY_NOT_FOUND',
}
```

---

## 8. 前端设计

### 8.1 页面路由

| 页面 | 路径 | 核心内容 |
|---|---|---|
| **Dashboard** | `/` | 书籍概览、字数进度、最近活动 |
| **章节管理** | `/chapters` | 按卷展示章节列表 |
| **章节编辑** | `/chapters/:id` | 左栏 Tiptap 编辑器 + 右栏 AI 对话面板 |
| **审稿报告** | `/chapters/:id/review` | 评分卡 + 问题列表 + 原文对照 |
| **知识库** | `/knowledge` | 分类 Tab + 条目列表 + 编辑器 |
| **关系图** | `/knowledge/relations` | React Flow 可视化 |
| **大纲** | `/knowledge/outline` | 树状大纲编辑器 |
| **AI 对话** | `/chat` | 独立对话界面 |
| **AI 记忆** | `/memory` | 摘要/时间线/角色状态浏览 |
| **工作区/发布** | `/workspace` | 章节勾选 + 发布 + 进度 |
| **统计** | `/analytics` | 数据图表 |
| **设置** | `/settings` | 模型配置 + Agent 分配 + Prompt 管理 |

### 8.2 核心页面：章节编辑页

左栏 Tiptap 富文本编辑器（纸张/手稿风格），右栏 AI 对话面板。
快捷操作：[构思] [续写] [审稿]
AI 回复后可 [✅ 应用到章节]

### 8.3 视觉设计

- 小说内容：纸张/手稿风格（衬线字体、柔和阴影、纹理背景）
- UI 区域：现代简洁（无衬线字体）
- 主题：明暗双色（亮色=暖色羊皮纸/墨水，暗色=深色/烛光）
- 状态管理：Zustand（按领域拆 Slice）
- SSE 客户端：自定义 `useSSE` Hook

---

## 9. 技术选型

| 层 | 选型 |
|---|---|
| **语言** | TypeScript 5.x |
| **包管理** | pnpm + monorepo |
| **前端** | React 19 + Vite + shadcn/ui + Radix + Tailwind CSS |
| **状态管理** | Zustand |
| **路由** | React Router v7 |
| **编辑器** | Tiptap + tiptap-markdown |
| **关系图** | React Flow |
| **动画** | Motion (framer-motion) |
| **图标** | Lucide React |
| **后端** | Hono |
| **AI SDK** | OpenAI SDK + 自封装适配层 |
| **测试** | Vitest |
| **Schema** | Zod |
| **文件监听** | chokidar |
| **代码规范** | ESLint + Prettier |

### LLM 抽象层

```typescript
export interface LLMClient {
  chatCompletion(messages: Message[], options: ChatOptions): Promise<string>;
  chatCompletionStream(messages: Message[], options: ChatOptions): AsyncGenerator<string>;
}

export interface LLMProvider {
  name: string;
  createClient(config: ProviderConfig): LLMClient;
}

const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  ollama: new OllamaProvider(),
  custom: new CustomEndpointProvider(),
};

export function createLLMClient(config: ModelConfig): LLMClient {
  const provider = providers[config.service];
  return provider.createClient(config);
}
```

---

## 10. Monorepo 工程结构

```
ai-novel/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── packages/
│   ├── core/                 # 核心引擎
│   │   └── src/
│   │       ├── agents/       # Agent 实现
│   │       ├── llm/          # LLM 抽象层
│   │       ├── memory/       # 记忆系统
│   │       ├── knowledge/    # 知识库管理
│   │       ├── workspace/    # 工作区管理
│   │       ├── models/       # 类型定义
│   │       ├── prompts/      # Prompt 模板
│   │       └── utils/
│   └── studio/               # Web 工作台
│       └── src/
│           ├── api/          # Hono 后端
│           ├── pages/        # 页面组件
│           ├── components/   # UI 组件
│           ├── hooks/        # React Hooks
│           ├── store/        # Zustand 状态
│           └── shared/       # 前后端共享类型
├── scripts/
└── test-project/
```

包依赖：`studio ──depends──→ core`

---

## 11. 运行时工程

### 11.1 错误处理与重试

核心原则：任何错误都不应导致用户已写内容丢失。

- 网络超时：自动重试 2-3 次，指数退避
- Rate Limit：等待 Retry-After 后重试
- JSON 格式错误：反馈给模型重新生成，最多 3 次
- 上下文溢出：自动压缩 Layer 3 后重试
- API Key 无效：返回错误提示

### 11.2 并发控制

同一时间只允许一个 AI 操作，其他排队。

### 11.3 安全

- API Key 存储在 `.env`（项目级 > 全局级 > 环境变量）
- 前端展示脱敏值 `sk-****...xxxx`
- 所有 API 使用 Zod 校验
- 文件路径防止路径遍历

---

## 12. 开发路线图

### Phase 1: MVP（2-3 周）
- 项目脚手架搭建（monorepo + TS 配置）
- LLM 抽象层（先支持 OpenAI）
- BaseAgent + WriterAgent + 基础 Prompt
- 文件系统存储（章节读写）
- Hono API Server（章节 CRUD）
- React 前端框架搭建
- 章节列表页 + 基础编辑器
- AI 对话面板（发消息 + 流式响应 + apply）
- 章节版本控制（快照 + 回退）
- 基础测试

### Phase 2: 核心流水线（3-4 周）
- 知识库系统 + 关系图 + React Flow
- BrainstormerAgent + AuditorAgent
- 审稿报告页面
- 工作区管理 + 发布流程
- SummarizerAgent + 发布时自动总结
- 章节状态流转
- 内存搜索引擎 + 文件监听
- 路由层

### Phase 3: 长篇记忆（2-3 周）
- 三层记忆系统
- 章节摘要 + 多章综合总结
- 时间线 + 角色状态变迁
- Token 预算管理
- 检索策略
- CuratorAgent

### Phase 4: 多模型 + 高级特性（2-3 周）
- Anthropic / Ollama Provider
- 模型配置管理 + Agent 分配
- 大纲编辑器 + 导出 + 统计
- Prompt 管理 UI + 对话历史管理

### Phase 5: 打磨（2-3 周）
- 纸张/手稿视觉风格 + 深色模式
- 动效优化
- 快捷操作条 + 响应式布局
- 性能优化 + 错误处理完善

### Phase 6: 生产化（1-2 周）
- 测试覆盖 + 用户文档
- npm 发布 + CI/CD
