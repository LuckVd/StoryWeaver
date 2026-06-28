/**
 * 对话 (Chat) 类型定义
 *
 * 对应 chat/ 目录，按 session 存储对话历史。
 */

/** LLM 消息角色 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** 一次工具调用(由 assistant 消息发起) */
export interface ToolCall {
  /** 调用 ID,用于关联后续 tool 角色消息 */
  id: string;
  /** 工具名 */
  name: string;
  /** 参数(JSON 字符串) */
  arguments: string;
}

/** LLM 消息 */
export interface Message {
  role: MessageRole;
  content: string;
  /** assistant 消息附带的一次或多次工具调用 */
  toolCalls?: ToolCall[];
  /** tool 角色消息关联的调用 ID */
  toolCallId?: string;
  /** tool 角色消息的工具名(部分 provider 需要) */
  name?: string;
}

/** 对话消息（含元信息） */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** 消息发送时间 */
  createdAt: string;
  /** 关联的 Agent 名称（assistant 消息有值） */
  agent?: string;
  /** Token 消耗 */
  tokenUsage?: number;
}

/** 对话会话 */
export interface ChatSession {
  id: string;
  /** 关联章节 ID（null 表示独立对话，不绑定章节） */
  chapterId: number | null;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

/** Apply 操作记录（用户将 AI 生成内容应用到章节） */
export interface ApplyRecord {
  chapterId: number;
  /** 被应用的 assistant 消息 ID */
  messageId: string;
  /** 应用方式：追加或替换 */
  mode: 'append' | 'replace';
  /** 替换的目标段落范围（mode=replace 时） */
  range?: { start: number; end: number };
  appliedAt: string;
}
