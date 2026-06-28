import type { Message, ToolCall } from '../models/index.js';

/** 工具定义(原生 function calling) */
export interface ToolDefinition {
  /** 工具名 */
  name: string;
  /** 工具用途描述(供 LLM 决策是否调用) */
  description: string;
  /** 参数 JSON Schema */
  parameters: Record<string, unknown>;
}

/**
 * LLM 调用选项
 */
export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** 可用工具定义(原生 function calling);provider 不支持时忽略 */
  tools?: ToolDefinition[];
  /** 工具调用策略:'auto' 自动 / 'none' 禁用 / 'required' 必须调用 */
  toolChoice?: 'auto' | 'none' | 'required';
  /** 额外传递给 Provider 的参数 */
  [key: string]: unknown;
}

/**
 * Token 使用量（从 API 响应提取）
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 聊天补全结果
 */
export interface ChatResult {
  content: string;
  usage?: TokenUsage;
  /** 模型发起的工具调用(原生 function calling);无则为 undefined */
  toolCalls?: ToolCall[];
}

/**
 * 供应商返回的可用模型(轻量,供前端选择)
 */
export interface AvailableModel {
  /** 模型标识,直接填入 ModelConfig.id */
  id: string;
  /** 展示名(可选,缺失时用 id) */
  name?: string;
}

/**
 * LLM 客户端接口
 */
export interface LLMClient {
  /** 普通补全 */
  chatCompletion(messages: Message[], options?: ChatOptions): Promise<ChatResult>;
  /** 流式补全 */
  chatCompletionStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string>;
  /** 是否支持原生工具调用(function calling);缺省 false。brainstormer 据此决定是否启用 agentic 探索 */
  readonly supportsTools?: boolean;
  /** 列出当前凭证/端点下可用模型(可选,不支持时缺省) */
  listModels?(): Promise<AvailableModel[]>;
}

/**
 * LLM Provider 接口
 */
export interface LLMProvider {
  /** Provider 名称 */
  name: string;
  /** 根据配置创建客户端 */
  createClient(apiKey: string, baseUrl?: string): LLMClient;
}
