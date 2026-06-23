import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaProvider } from '../ollama-provider.js';
import type { LLMClient } from '../types.js';

describe('OllamaProvider', () => {
  let client: LLMClient;
  const provider = new OllamaProvider();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    client = provider.createClient('', 'http://localhost:11434');
  });

  it('name 为 ollama', () => {
    expect(provider.name).toBe('ollama');
  });

  it('chatCompletion 解析 content + usage', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { content: '你好' }, prompt_eval_count: 8, eval_count: 4 }),
    });
    const r = await client.chatCompletion([{ role: 'user', content: 'Hi' }], { model: 'llama3' });
    expect(r.content).toBe('你好');
    expect(r.usage?.totalTokens).toBe(12);
  });

  it('无 usage 时返回 undefined', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { content: 'ok' } }),
    });
    const r = await client.chatCompletion([{ role: 'user', content: 'Hi' }], { model: 'llama3' });
    expect(r.content).toBe('ok');
    expect(r.usage).toBeUndefined();
  });

  it('chatCompletion 非 ok 抛错', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' });
    await expect(
      client.chatCompletion([{ role: 'user', content: 'Hi' }], { model: 'llama3' }),
    ).rejects.toThrow(/500/);
  });

  it('chatCompletionStream yield NDJSON content', async () => {
    const ndjson =
      [
        JSON.stringify({ message: { content: 'Hel' } }),
        JSON.stringify({ message: { content: 'lo' }, done: true }),
      ].join('\n') + '\n';
    const encoder = new TextEncoder();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => {
          let sent = false;
          return {
            read: async () => {
              if (sent) return { done: true, value: undefined };
              sent = true;
              return { done: false, value: encoder.encode(ndjson) };
            },
          };
        },
      },
    });
    const tokens: string[] = [];
    for await (const t of client.chatCompletionStream([{ role: 'user', content: 'Hi' }], { model: 'llama3' })) {
      tokens.push(t);
    }
    expect(tokens).toEqual(['Hel', 'lo']);
  });
});
