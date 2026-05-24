/**
 * Agent 类型定义
 *
 * 5 个 Agent + 路由层。
 */

/** Agent 名称 */
export type AgentName =
  | 'brainstormer'
  | 'writer'
  | 'auditor'
  | 'summarizer'
  | 'curator'
  | 'router';

/** Agent 配置 */
export interface AgentConfig {
  /** 使用的模型 ID */
  model: string;
  /** 温度参数，越高越随机 */
  temperature?: number;
  /** 最大输出 tokens */
  maxTokens?: number;
  /** 系统提示词（可被自定义 Prompt 覆盖） */
  systemPrompt?: string;
}

/** 路由上下文 */
export interface RoutingContext {
  /** 当前章节 ID */
  chapterId?: number;
  /** 当前章节状态 */
  chapterStatus?: string;
  /** 对话历史（最近几轮） */
  recentMessages?: Array<{ role: string; content: string }>;
}
