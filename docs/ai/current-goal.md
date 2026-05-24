# Current Goal

## Goal

G01-S02 — Core 类型定义

在 `packages/core/src/models/` 下创建全项目共享的 TypeScript 类型定义，覆盖 Book、Chapter、Config、Knowledge、Chat、Memory、Workspace、Agent、API 等领域模型，统一导出。

## Current State

从 roadmap G01-S02 激活，等待确认方案。

## Chosen Approach

按领域拆分类型文件，每个文件一个关注点，通过 `models/index.ts` 统一 re-export。所有类型使用 `interface` / `type` 定义，配合 Zod schema 用于运行时校验（Phase 1 先只定义类型，Zod schema 留到后续子目标）。

## Acceptance Criteria

- [ ] `models/` 目录下创建所有类型文件，按领域组织
- [ ] 每个类型文件有清晰的注释说明
- [ ] `models/index.ts` 统一导出所有类型
- [ ] `packages/core/src/index.ts` re-export `models/index.ts`
- [ ] `pnpm build` 零错误
- [ ] 类型覆盖 tech-spec-v1.md 中所有定义的 interface/type/enum

## Test Plan

- `pnpm build` 零错误通过
- `tsc --noEmit` 类型检查通过
- 从 `@storyweaver/core` 可导入所有类型（编译通过）

## Steps

### Step 1: 创建 models 目录结构

```
packages/core/src/models/
├── index.ts            # 统一导出
├── book.ts             # Book 相关类型
├── chapter.ts          # Chapter, ChapterStatus, ChapterVersion
├── config.ts           # ModelConfig, AgentModelConfig, NovelConfig
├── knowledge.ts        # Knowledge 各分类 + RelationEdge
├── chat.ts             # Message, ChatSession, ChatMessage
├── memory.ts           # ChapterSummary, BatchSummary, StoryStateSnapshot, StateChange, TokenBudget
├── workspace.ts        # Workspace 类型
├── agent.ts            # AgentName, AgentConfig
└── api.ts              # SSEEvent, ErrorCode, APIError
```

### Step 2: 实现各类型文件

依据 tech-spec-v1.md 中的类型定义，逐文件编写：

**book.ts** — Book 元信息（对应 novel.yaml）
```typescript
interface Book {
  title: string;
  genre: string;
  language: string;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
  nextChapterId: number;
}
type BookStatus = 'drafting' | 'in_progress' | 'completed' | 'archived';
```

**chapter.ts** — Chapter + ChapterVersion
```typescript
type ChapterStatus = 'draft' | 'approved' | 'published';
interface Chapter {
  id: number;
  volume: number;
  title: string;
  content: string;
  wordCount: number;
  status: ChapterStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}
interface ChapterVersion { ... } // 如 tech-spec 定义
```

**config.ts** — ModelConfig, AgentModelConfig
```typescript
interface ModelConfig { ... }    // 如 tech-spec 定义
interface AgentModelConfig { ... }
interface NovelConfig { ... }    // novel.yaml 顶层结构
```

**knowledge.ts** — 所有知识库类型 + RelationEdge
```typescript
type KnowledgeCategory = 'characters' | 'world' | 'items' | 'outline' | 'hooks' | 'rules' | 'custom' | 'timeline';
interface Character { ... }
interface WorldEntry { ... }
interface KnowledgeItem { ... }
interface Hook { ... }            // 伏笔
interface HookStatus = 'active' | 'resolved';
interface OutlineNode { ... }
interface Rule { ... }
interface RelationEdge { ... }    // 如 tech-spec 定义
```

**chat.ts** — 对话相关
```typescript
interface Message { role: 'system' | 'user' | 'assistant'; content: string; }
interface ChatSession { ... }
interface ChatMessage { ... }
```

**memory.ts** — 记忆系统
```typescript
interface ChapterSummary { ... }       // 如 tech-spec 定义
interface BatchSummary { ... }
interface StoryStateSnapshot { ... }
interface StateChange { ... }
interface TokenBudget { ... }
```

**workspace.ts** — 工作区
```typescript
interface Workspace {
  chapterIds: number[];
  createdAt: string;
  updatedAt: string;
}
```

**agent.ts** — Agent 相关
```typescript
type AgentName = 'brainstormer' | 'writer' | 'auditor' | 'summarizer' | 'curator' | 'router';
interface AgentConfig { ... }
```

**api.ts** — API 层
```typescript
type SSEEvent = ...;    // 如 tech-spec 定义
enum ErrorCode { ... }  // 如 tech-spec 定义
interface APIError { code: ErrorCode; message: string; details?: unknown; }
```

### Step 3: 统一导出

- `models/index.ts` re-export 所有类型
- 更新 `src/index.ts` 增加 `export * from './models/index.js'`

### Step 4: 验证构建

- `pnpm build` 零错误
- `tsc --noEmit` 通过

## Tasks

- [ ] 创建 models/ 目录及 index.ts
- [ ] 实现 book.ts
- [ ] 实现 chapter.ts
- [ ] 实现 config.ts
- [ ] 实现 knowledge.ts
- [ ] 实现 chat.ts
- [ ] 实现 memory.ts
- [ ] 实现 workspace.ts
- [ ] 实现 agent.ts
- [ ] 实现 api.ts
- [ ] 更新 src/index.ts 统一导出
- [ ] 验证 pnpm build 通过

## Blockers

- 无（依赖 G01-S01 已完成）

## Open Questions

- 无

## Parent Goal

- G01 — Phase 1: MVP (roadmap)
- 完成后继续 → G01-S03 文件系统存储层

## Sync Notes

- 目标激活自 roadmap G01-S02，G01-S01 已完成
