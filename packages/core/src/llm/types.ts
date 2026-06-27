import type { Message } from '../models/index.js';

/**
 * LLM 调用选项
 */
export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
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
