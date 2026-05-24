/**
 * 章节 (Chapter) 类型定义
 *
 * 最小创作单元，自增数字 ID，对应 volumes/vXX/chXXX.md。
 */

/** 章节状态流转：draft → approved → published（不可逆） */
export type ChapterStatus = 'draft' | 'approved' | 'published';

/** 版本快照触发来源 */
export type VersionTrigger = 'save' | 'ai_apply' | 'status_change';

/** 章节 */
export interface Chapter {
  id: number;
  volume: number;
  title: string;
  content: string;
  wordCount: number;
  status: ChapterStatus;
  createdAt: string;
  updatedAt: string;
  /** 定稿/发布时间戳，仅 published 状态有值 */
  publishedAt?: string;
}

/** 章节版本快照 */
export interface ChapterVersion {
  /** 版本号（自增） */
  id: number;
  chapterId: number;
  content: string;
  trigger: VersionTrigger;
  /** 如 "AI 续写了密室场景" / "状态变更为 approved" */
  description?: string;
  wordCount: number;
  createdAt: string;
}
