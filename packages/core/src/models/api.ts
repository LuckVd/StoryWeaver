/**
 * API 层类型定义
 *
 * SSE 事件、错误码、API 错误响应。
 */

import type { AgentName } from './agent.js';

// ── SSE 事件 ──

/** Agent 阶段标识 */
export type AgentStage = 'thinking' | 'generating' | 'reviewing' | 'summarizing';

/** SSE 事件类型 */
export type SSEEvent =
  | { type: 'agent:start'; data: { agent: AgentName; stage: string } }
  | { type: 'agent:token'; data: { agent: AgentName; token: string } }
  | { type: 'agent:complete'; data: { agent: AgentName; result: unknown; messageId: string } }
  | { type: 'review:score'; data: { score: number; issues: unknown[] } }
  | { type: 'chapter:complete'; data: { chapterId: number; wordCount: number } }
  | { type: 'publish:progress'; data: { step: string; current: number; total: number } }
  | { type: 'publish:complete'; data: { chapters: number[] } }
  | { type: 'summary:complete'; data: { chapter: number } }
  | { type: 'curation:complete'; data: { chapter: number } }
  | { type: 'file:changed'; data: { path: string } }
  | { type: 'file:added'; data: { path: string } }
  | { type: 'file:removed'; data: { path: string } }
  | { type: 'error'; data: { message: string; recoverable: boolean } }
  | { type: 'truth:updated'; data: { file: string } };

// ── 错误码 ──

/** API 错误码 */
export enum ErrorCode {
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

/** API 错误响应 */
export interface APIError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}
