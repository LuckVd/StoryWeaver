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

/** 大纲节点（全书 > 卷 > 章节，树状结构） */
export interface OutlineNode {
  id: string;
  /** 节点类型 */
  type: 'book' | 'volume' | 'chapter';
  title: string;
  /** 概要描述 */
  summary?: string;
  /** 关联章节 ID（仅 chapter 类型） */
  chapterId?: number;
  /** 子节点 */
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
