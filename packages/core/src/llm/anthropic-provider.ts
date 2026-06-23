import type { Message } from '../models/index.js';
import type { LLMClient, LLMProvider, ChatOptions, ChatResult, TokenUsage } from './types.js';

/**
 * Anthropic LLM Provider(G05-S01)
 *
 * 直接用 fetch 调 Anthropic Messages API(/v1/messages),不引入额外 SDK。
 * - system 消息单独抽取到顶层 system 字段;
 * - 流式解析 SSE(content_block_delta 事件)。
 */

const ANTHROPIC_DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const RETRY_MAX = 3;
const RETRY_BASE_DELAY_MS = 1000;

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    if (status === 429 || (status ?? 0) >= 500) return true;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('fetch failed')) return true;
  }
  return false;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 把 Message[] 转为 Anthropic 载荷(system 提到顶层,其余保留 role/content) */
function toAnthropicPayload(messages: Message[]): {
  system?: string;
  messages: { role: string; content: string }[];
} {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  return {
    ...(systemParts.length ? { system: systemParts.join('\n\n') } : {}),
    messages: rest,
  };
}

class AnthropicClient implements LLMClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl?: string,
  ) {}

  private get url(): string {
    return `${this.baseUrl ?? ANTHROPIC_DEFAULT_BASE_URL}/v1/messages`;
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    };
  }

  async chatCompletion(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    const body = {
      model: options?.model ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? 4096,
      ...toAnthropicPayload(messages),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    };

    let lastError: unknown;
    for (let attempt = 0; attempt < RETRY_MAX; attempt++) {
      try {
        const res = await fetch(this.url, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = new Error(
            `Anthropic API ${res.status}: ${await res.text().catch(() => '')}`,
          ) as Error & { status?: number };
          err.status = res.status;
          throw err;
        }
        const data = (await res.json()) as {
          content?: Array<{ type: string; text?: string }>;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const text =
          data.content
            ?.filter((b) => b.type === 'text')
            .map((b) => b.text ?? '')
            .join('') ?? '';
        const usage: TokenUsage | undefined = data.usage
          ? {
              promptTokens: data.usage.input_tokens ?? 0,
              completionTokens: data.usage.output_tokens ?? 0,
              totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
            }
          : undefined;
        return { content: text, usage };
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === RETRY_MAX - 1) throw error;
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
    throw lastError;
  }

  async *chatCompletionStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    const body = {
      model: options?.model ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? 4096,
      stream: true,
      ...toAnthropicPayload(messages),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    };
    const res = await fetch(this.url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Anthropic stream failed: ${res.status}`);
    }
    // 解析 SSE:event 行 + data 行,取 content_block_delta 的 delta.text
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const evt = JSON.parse(line.slice(6)) as {
            type?: string;
            delta?: { text?: string };
          };
          if (evt.type === 'content_block_delta' && evt.delta?.text) {
            yield evt.delta.text;
          }
        } catch {
          // 跳过非 JSON / 不完整行
        }
      }
    }
  }
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';

  createClient(apiKey: string, baseUrl?: string): LLMClient {
    return new AnthropicClient(apiKey, baseUrl);
  }
}
