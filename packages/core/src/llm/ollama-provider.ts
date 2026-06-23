import type { Message } from '../models/index.js';
import type { LLMClient, LLMProvider, ChatOptions, ChatResult, TokenUsage } from './types.js';

/**
 * Ollama LLM Provider(G05-S01)
 *
 * 直接用 fetch 调 Ollama 原生 /api/chat(本地部署,默认 http://localhost:11434)。
 * - 非流式:返回 { message: { content } };
 * - 流式:NDJSON(每行一个 { message: { content } },done=true 结束)。
 * 不需要 API Key(本地)。
 */

const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3';

class OllamaClient implements LLMClient {
  constructor(private readonly baseUrl?: string) {}

  private get url(): string {
    return `${this.baseUrl ?? OLLAMA_DEFAULT_BASE_URL}/api/chat`;
  }

  async chatCompletion(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: options?.model ?? DEFAULT_MODEL,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        ...(options?.temperature !== undefined ? { options: { temperature: options.temperature } } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama API ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const data = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const usage: TokenUsage | undefined =
      data.prompt_eval_count !== undefined || data.eval_count !== undefined
        ? {
            promptTokens: data.prompt_eval_count ?? 0,
            completionTokens: data.eval_count ?? 0,
            totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
          }
        : undefined;
    return { content: data.message?.content ?? '', usage };
  }

  async *chatCompletionStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: options?.model ?? DEFAULT_MODEL,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Ollama stream failed: ${res.status}`);
    }
    // NDJSON:每行 { message: { content } , done }
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
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          if (obj.message?.content) yield obj.message.content;
        } catch {
          // 跳过不完整行
        }
      }
    }
  }
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';

  createClient(_apiKey: string, baseUrl?: string): LLMClient {
    // Ollama 本地部署,无需 apiKey
    return new OllamaClient(baseUrl);
  }
}
