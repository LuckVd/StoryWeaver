/**
 * 知识库 (Knowledge) 类型定义
 *
 * 对应 knowledge/ 目录下的结构化 JSON 数据。
 * 人工维护为主，AI 可辅助维护（需人工确认）。
 */

/** 知识库分类 */
export type KnowledgeCategory =
  | 'characters'
  | 'world'
  | 'items'
  | 'outline'
  | 'hooks'
  | 'rules'
  | 'custom'
  | 'timeline';

/** 世界观子分类 */
export type WorldSubCategory =
  | 'geography'
  | 'power-system'
  | 'factions'
  | 'history'
  | 'glossary';

/** 伏笔状态 */
export type HookStatus = 'active' | 'resolved';

/** 关系方向 */
export type RelationDirection = 'mutual' | 'directed';

// ── 角色 ──

/** 角色档案 */
export interface Character {
  id: string;
  name: string;
  /** 别名/外号 */
  aliases?: string[];
  /** 角色简介 */
  description: string;
  /** 详细档案（长文本） */
  profile?: string;
  /** 首次出场章节 */
  firstAppearance?: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── 世界观 ──

/** 世界观条目（通用结构，适用于 geography/power-system/factions/history/glossary） */
export interface WorldEntry {
  id: string;
  category: WorldSubCategory;
  name: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── 物品 ──

/** 物品档案 */
export interface Item {
  id: string;
  name: string;
  description: string;
  /** 当前归属角色 ID */
  owner?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── 大纲 ──

/**
 * 大纲节点（全书 > 剧情卷 > 大事件，树状结构）
 *
 * 粗粒度的"剧情方向把控层":卷(arc)给宏观走向,大事件(milestone)标卷内关键节点。
 * 与章节摘要(实际发生)、StoryState(当前状态)分工——大纲只讲"往哪走"的前方规划。
 * arc 用 chapterRange 关联其覆盖的正文章节范围,供按"当前写到第几章"定位当前卷。
 */
export interface OutlineNode {
  id: string;
  /** 节点类型:book 书根 / arc 剧情卷 / milestone 大事件 */
  type: 'book' | 'arc' | 'milestone';
  title: string;
  /** 概要:arc=本卷方向(目标/冲突/走向);milestone=该大事件要点 */
  summary?: string;
  /** 仅 arc:覆盖的正文章节范围 [起, 止],用于按当前章定位当前卷 */
  chapterRange?: [number, number];
  /** 子节点:book→arc;arc→milestone */
  children?: OutlineNode[];
  sortOrder: number;
}

// ── 伏笔 ──

/** 伏笔 */
export interface Hook {
  id: string;
  name: string;
  description: string;
  status: HookStatus;
  /** 埋设章节 */
  plantedAt: number;
  /** 回收章节（resolved 时有值） */
  resolvedAt?: number;
  /** 关联实体 ID 列表 */
  relatedEntities?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── 写作规则 ──

/** 写作规则 */
export interface Rule {
  id: string;
  /** 规则类型 */
  category: 'style' | 'taboo' | 'narrative_perspective' | 'custom';
  name: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
}

// ── 自定义 ──

/** 自定义知识条目 */
export interface CustomKnowledge {
  id: string;
  /** 用户自定义分类名 */
  category: string;
  name: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── 关系图 ──

/** 关系边（邻接表） */
export interface RelationEdge {
  id: string;
  /** 起始实体 ID */
  from: string;
  /** 目标实体 ID */
  to: string;
  /** 关系类型（师徒/宿敌/暗恋/同门...） */
  type: string;
  /** 双向或单向 */
  direction: RelationDirection;
  /** 从哪章开始 */
  since?: string;
  /** 补充说明 */
  note?: string;
}

// ── 时间线 ──

/** 时间线条目（AI 维护，发布时自动生成/更新） */
export interface TimelineEntry {
  id: string;
  /** 对应章节 */
  chapterId: number;
  /** 故事内时间 */
  narrativeTime?: string;
  /** 事件描述 */
  event: string;
  /** 涉及角色 */
  characters?: string[];
  /** 涉及地点 */
  locations?: string[];
  createdAt: string;
}
