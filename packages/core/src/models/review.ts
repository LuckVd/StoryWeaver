/**
 * 审稿 (Review) 类型定义
 *
 * 对应 reviews/ 目录，每次审稿生成独立记录。
 * Phase 2 功能，类型提前定义。
 */

/** 审稿评分维度 */
export type ReviewDimension =
  | 'character_consistency'
  | 'timeline'
  | 'worldview'
  | 'hooks'
  | 'pacing'
  | 'style'
  | 'length';

/** 问题严重程度 */
export type IssueSeverity = 'high' | 'medium' | 'low';

/** 按维度评分 */
export interface ReviewScore {
  dimension: ReviewDimension;
  /** 0-10 分 */
  score: number;
  /** 权重 */
  weight: number;
  comment?: string;
}

/** 具体问题 */
export interface ReviewIssue {
  dimension: ReviewDimension;
  severity: IssueSeverity;
  /** 原文位置引用 */
  location: string;
  /** 问题描述 */
  description: string;
  /** 修改建议 */
  suggestion?: string;
}

/** 审稿报告 */
export interface ReviewReport {
  id: string;
  chapterId: number;
  /** 综合评分（加权计算） */
  overallScore: number;
  scores: ReviewScore[];
  issues: ReviewIssue[];
  /** 审稿总结 */
  summary: string;
  createdAt: string;
}
