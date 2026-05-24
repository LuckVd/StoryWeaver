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
