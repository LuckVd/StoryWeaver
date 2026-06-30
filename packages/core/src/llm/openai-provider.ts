import OpenAI from 'openai';
import { fetch as undiciFetch } from 'undici';
import type { Message } from '../models/index.js';
import type { LLMClient, LLMProvider, ChatOptions, ChatResult, TokenUsage, ToolDefinition } from './types.js';

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

/** 将内部 ToolDefinition 转为 OpenAI tools 格式 */
function toOpenAITool(tool: ToolDefinition): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

/**
 * 将 Message[] 转换为 OpenAI 格式(支持 tool 角色 / assistant 的 toolCalls)
 */
function toOpenAIMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        content: m.content,
        tool_call_id: m.toolCallId ?? '',
        ...(m.name ? { name: m.name } : {}),
      };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content ?? '',
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role, content: m.content } as OpenAI.Chat.Completions.ChatCompletionMessageParam;
  });
}

/**
 * OpenAI LLM Client(同时服务于 GLM / DeepSeek —— 它们复用本类以获得原生 function calling)
 */
export class OpenAIClient implements LLMClient {
  readonly supportsTools = true;
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(apiKey: string, baseUrl?: string, defaultModel = 'gpt-4o') {
    this.client = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
      // 注入最新 undici 的 fetch,绕过宿主(Electron 内置 Node 的旧版 undici)
      // 与 Cloudflare 等 HTTP/2 网关的 "Premature close" 兼容问题
      fetch: undiciFetch as unknown as typeof globalThis.fetch,
    });
    this.defaultModel = defaultModel;
  }

  async chatCompletion(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: options?.model ?? this.defaultModel,
      messages: toOpenAIMessages(messages),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
      ...(options?.tools?.length
        ? {
            tools: options.tools.map(toOpenAITool),
            tool_choice: options.toolChoice ?? 'auto',
          }
        : {}),
    };

    let lastError: unknown;
    for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await this.client.chat.completions.create(params);
        const msg = response.choices[0]?.message;
        const content = msg?.content ?? '';
        const toolCalls = msg?.tool_calls?.map((tc) => {
          // 防御异常 provider 响应(function 缺失/字段异常),避免 TypeError
          const fn = tc.function ?? { name: '', arguments: '{}' };
          return { id: tc.id, name: fn.name ?? '', arguments: fn.arguments ?? '{}' };
        });
        const result: ChatResult = { content, usage: extractUsage(response) };
        if (toolCalls?.length) result.toolCalls = toolCalls;
        return result;
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
      model: options?.model ?? this.defaultModel,
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

  /** 列出可用模型(走 OpenAI SDK models.list(),兼容 openai / glm / deepseek) */
  async listModels(): Promise<{ id: string; name?: string }[]> {
    const list: { id: string; name?: string }[] = [];
    for await (const m of await this.client.models.list()) {
      list.push({ id: m.id, name: m.id });
    }
    return list;
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
