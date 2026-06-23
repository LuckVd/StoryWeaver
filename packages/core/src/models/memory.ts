/**
 * AI 记忆 (Memory) 类型定义
 *
 * 对应 memory/ 目录，AI 自动维护的结构化记忆。
 * 发布时自动生成/更新，人工可修正。
 */

/** 状态变迁记录 */
export interface StateChange {
  entity: string;
  field: string;
  from: string;
  to: string;
}

/** 章节摘要（每章发布后 AI 生成） */
export interface ChapterSummary {
  chapter: number;
  volume: number;
  title: string;
  /** 主要情节事件 */
  plotEvents: string[];
  /** 一句话结果 */
  plotOutcome: string;
  /** 出场角色 */
  charactersPresent: string[];
  /** 角色行动 { "张三": "破解阵法" } */
  characterActions: Record<string, string>;
  /** 本章新揭示的信息 */
  newRevealedInfo: string[];
  /** 涉及地点 */
  locationsUsed: string[];
  /** 推进了哪些伏笔 */
  hooksAdvanced: string[];
  /** 新埋了哪些伏笔 */
  hooksPlanted: string[];
  /** 状态变迁 */
  stateChanges: StateChange[];
  /** 故事内时间 */
  narrativeTime?: string;
  wordCount: number;
}

/** 多章综合总结（每 N 章生成一次） */
export interface BatchSummary {
  /** 章节范围 [起始, 结束] */
  chapterRange: [number, number];
  volume: number;
  /** 核心剧情线（500 字以内） */
  narrativeArc: string;
  /** 关键转折点 */
  turningPoints: string[];
  /** 角色发展 { "张三": "从金丹突破到元婴" } */
  characterDevelopment: Record<string, string>;
  /** 未解决的问题 */
  unresolvedThreads: string[];
}

/** Layer 1 剧情状态快照（存储于 memory/story-state.json） */
export interface StoryStateSnapshot {
  /** 最后发布的章节号 */
  lastPublishedChapter: number;
  /** 当前故事弧概述（100 字以内） */
  currentArc: string;
  /** 当前活跃角色列表 */
  activeCharacters: string[];
  /** 故事当前发生地 */
  currentLocation: string;
  /** 最近 3-5 个关键事件（每条 20 字以内） */
  recentEvents: string[];
  /** 当前悬而未决的问题 */
  openQuestions: string[];
  /** 发布时 Summarizer 生成/更新 */
  updatedAt: string;
}

/** Token 预算管理 */
export interface TokenBudget {
  /** 模型上下文窗口（如 128000） */
  total: number;
  /** Agent 角色定义 ~500 */
  systemPrompt: number;
  /** 永久记忆 ~3000 */
  layer1: number;
  /** 近期记忆 ~6000 */
  layer2: number;
  /** 远期记忆（动态计算剩余空间） */
  layer3: number;
  /** 留给 AI 输出 ~4000 */
  outputReserve: number;
}

/** 伏笔在某章的一次出现(埋设或推进) */
export interface HookMention {
  chapter: number;
  /** 该章对此伏笔的动作:planted=新埋设 advanced=推进 */
  type: 'planted' | 'advanced';
}

/** 单个伏笔的追踪视图(从 Hook 实体 + 章节摘要聚合,不依赖 LLM,不受回忆/穿越影响) */
export interface HookTracking {
  name: string;
  status: 'active' | 'resolved';
  description: string;
  /** 埋设章节(Hook.plantedAt) */
  plantedAt: number;
  /** 出现轨迹(从章节摘要的 hooksPlanted/hooksAdvanced 聚合,按章节升序) */
  mentions: HookMention[];
  /** 最后一次出现的章节(无则用 plantedAt) */
  lastMention: number;
  /** 距离当前章的沉默章数(currentChapter - lastMention) */
  silentChapters: number;
}

/** 单个角色的单次状态变迁 */
export interface CharacterStateEntry {
  chapter: number;
  field: string;
  from: string;
  to: string;
}

/** 单个角色的聚合状态(memory/character-states.json 里的一项) */
export interface CharacterState {
  entity: string;
  /** 各字段的当前(最新)值 */
  currentState: Record<string, string>;
  /** 完整变迁历史,按章节号升序 */
  history: CharacterStateEntry[];
}

/** 完整角色状态集合(存储于 memory/character-states.json) */
export interface CharacterStates {
  /** 按 entity 名排序 */
  characters: CharacterState[];
  /** 重建时间(ISO) */
  updatedAt: string;
}

/** Curator 提取的实体建议(待人工确认后入库,不自动写入知识库) */
export interface CurationSuggestion {
  /** 来源章节 */
  chapter: number;
  /** 提取时间(ISO) */
  createdAt: string;
  /** 建议加入的角色 */
  characters: Array<{ name: string; description: string; reason: string }>;
  /** 建议加入的伏笔 */
  hooks: Array<{ name: string; description: string }>;
  /** 建议加入的世界观条目 */
  worldEntries: Array<{ name: string; category: string; content: string }>;
}

/** 全部 curation 建议(按章节聚合,存储于 memory/curation-suggestions.json) */
export interface CurationSuggestions {
  /** 按章节号升序 */
  suggestions: CurationSuggestion[];
  /** 更新时间(ISO) */
  updatedAt: string;
}

/** 记忆操作日志条目(伏笔状态变更、实体建议加入/放弃,均留痕可追溯) */
export interface ActionLogEntry {
  /** 动作类型 */
  action: 'hook_resolve' | 'hook_reactivate' | 'curation_accept' | 'curation_dismiss';
  /** 目标实体名 */
  target: string;
  /** 相关章节(伏笔完成章 / 实体来源章) */
  chapter?: number;
  /** 实体建议分类(仅 curation 动作) */
  category?: 'characters' | 'hooks' | 'worldEntries';
  /** 时间(ISO) */
  at: string;
}

/** 操作日志(存储于 memory/action-log.json) */
export interface ActionLog {
  entries: ActionLogEntry[];
}
