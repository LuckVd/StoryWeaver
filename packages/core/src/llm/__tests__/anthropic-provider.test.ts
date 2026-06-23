import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicProvider } from '../anthropic-provider.js';
import type { LLMClient } from '../types.js';

describe('AnthropicProvider', () => {
  let client: LLMClient;
  const provider = new AnthropicProvider();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    client = provider.createClient('test-key');
  });

  it('name 为 anthropic', () => {
    expect(provider.name).toBe('anthropic');
  });

  it('chatCompletion 解析 content + usage,system 提到顶层', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '你好' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
    const r = await client.chatCompletion(
      [{ role: 'system', content: 'S' }, { role: 'user', content: 'Hi' }],
      { model: 'claude-sonnet-4-6' },
    );
    expect(r.content).toBe('你好');
    expect(r.usage?.totalTokens).toBe(15);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe('S');
    expect(body.messages[0].role).toBe('user');
  });

  it('chatCompletion 非 ok 抛错(含 status)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'unauthorized' });
    await expect(
      client.chatCompletion([{ role: 'user', content: 'Hi' }], { model: 'claude-sonnet-4-6' }),
    ).rejects.toThrow(/401/);
  });

  it('chatCompletionStream yield SSE content_block_delta', async () => {
    const sse = [
      'event: message_start\ndata: {"type":"message_start"}\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"Hel"}}\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"lo"}}\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n',
    ].join('');
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
              return { done: false, value: encoder.encode(sse) };
            },
          };
        },
      },
    });
    const tokens: string[] = [];
    for await (const t of client.chatCompletionStream([{ role: 'user', content: 'Hi' }], { model: 'claude-sonnet-4-6' })) {
      tokens.push(t);
    }
    expect(tokens).toEqual(['Hel', 'lo']);
  });
});
