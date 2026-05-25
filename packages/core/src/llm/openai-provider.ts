import OpenAI from 'openai';
import type { Message } from '../models/index.js';
import type { LLMClient, LLMProvider, ChatOptions, ChatResult, TokenUsage } from './types.js';

/** 重试配置 */
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * 可重试的错误类型判断（duck typing，不依赖 instanceof）
 */
function isRetryableError(error: unknown): boolean {
  // HTTP 错误：检查 status 属性
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    if (status === 429 || (status ?? 0) >= 500) return true;
  }
  // 网络超时、连接错误
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('fetch failed')) return true;
  }
  return false;
}

/**
 * 延迟工具
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 从 OpenAI 响应中提取 TokenUsage
 */
function extractUsage(response: OpenAI.Chat.Completions.ChatCompletion): TokenUsage | undefined {
  if (!response.usage) return undefined;
  return {
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    totalTokens: response.usage.total_tokens,
  };
}

/**
 * 将 Message[] 转换为 OpenAI 格式
 */
function toOpenAIMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}

/**
 * OpenAI LLM Client
 */
class OpenAIClient implements LLMClient {
  private readonly client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
  }

  async chatCompletion(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: options?.model ?? 'gpt-4o',
      messages: toOpenAIMessages(messages),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
    };

    let lastError: unknown;
    for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await this.client.chat.completions.create(params);
        const content = response.choices[0]?.message?.content ?? '';
        return { content, usage: extractUsage(response) };
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === RETRY_MAX_ATTEMPTS - 1) {
          throw error;
        }
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
    throw lastError;
  }

  async *chatCompletionStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
      model: options?.model ?? 'gpt-4o',
      messages: toOpenAIMessages(messages),
      stream: true,
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
    };

    const stream = await this.client.chat.completions.create(params);
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        yield token;
      }
    }
  }
}

/**
 * OpenAI Provider
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';

  createClient(apiKey: string, baseUrl?: string): LLMClient {
    return new OpenAIClient(apiKey, baseUrl);
  }
}
