import { describe, it, expect, vi } from 'vitest';
import type { LLMClient, ChatOptions, ChatResult, ToolDefinition } from '../../llm/types.js';
import type { Message, AgentConfig, ToolCall } from '../../models/index.js';
import { BaseAgent } from '../base-agent.js';
import { z } from 'zod';

/** 创建一个可测试的具体子类 */
class TestAgent extends BaseAgent {
  async callChat(messages: Message[], options?: ChatOptions) {
    return this.chat(messages, options);
  }

  async *callChatStream(messages: Message[], options?: ChatOptions) {
    yield* this.chatStream(messages, options);
  }

  async callChatStructured<T>(messages: Message[], schema: z.ZodSchema<T>, maxRetries = 3) {
    return this.chatStructured(messages, schema, maxRetries);
  }

  async *callChatWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    executor: (call: ToolCall) => Promise<string>,
    opts?: { maxIterations?: number; onToolCall?: (name: string, args: string) => void },
  ) {
    yield* this.chatWithToolsStream(messages, tools, executor, opts);
  }
}

function createMockClient(result: ChatResult = { content: 'hello' }) {
  return {
    chatCompletion: vi.fn().mockResolvedValue(result),
    chatCompletionStream: vi.fn().mockImplementation(async function* () {
      yield 'hel';
      yield 'lo';
    }),
  } as unknown as LLMClient;
}

const defaultConfig: AgentConfig = {
  model: 'gpt-4o',
  temperature: 0.7,
};

describe('BaseAgent', () => {
  describe('chat()', () => {
    it('should call LLMClient.chatCompletion and return content', async () => {
      const client = createMockClient({ content: 'AI response' });
      const agent = new TestAgent(client, defaultConfig);
      const messages: Message[] = [{ role: 'user', content: 'test' }];

      const result = await agent.callChat(messages);

      expect(result).toBe('AI response');
      expect(client.chatCompletion).toHaveBeenCalledWith(
        [{ role: 'user', content: 'test' }],
        expect.objectContaining({ model: 'gpt-4o', temperature: 0.7 }),
      );
    });

    it('should use default temperature 0.7 when not configured', async () => {
      const client = createMockClient();
      const config: AgentConfig = { model: 'gpt-4o' };
      const agent = new TestAgent(client, config);

      await agent.callChat([{ role: 'user', content: 'hi' }]);

      expect(client.chatCompletion).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ temperature: 0.7 }),
      );
    });

    it('should allow options override', async () => {
      const client = createMockClient();
      const agent = new TestAgent(client, defaultConfig);

      await agent.callChat([{ role: 'user', content: 'hi' }], {
        model: 'gpt-4o',
        temperature: 0.9,
        maxTokens: 1000,
      });

      expect(client.chatCompletion).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ temperature: 0.9, maxTokens: 1000 }),
      );
    });
  });

  describe('chatStream()', () => {
    it('should yield tokens from LLMClient', async () => {
      const client = createMockClient();
      const agent = new TestAgent(client, defaultConfig);

      const tokens: string[] = [];
      for await (const token of agent.callChatStream([
        { role: 'user', content: 'test' },
      ])) {
        tokens.push(token);
      }

      expect(tokens).toEqual(['hel', 'lo']);
      expect(client.chatCompletionStream).toHaveBeenCalled();
    });
  });

  describe('chatStructured()', () => {
    it('should parse and return structured output', async () => {
      const client = createMockClient({
        content: JSON.stringify({ name: 'Alice', age: 25 }),
      });
      const agent = new TestAgent(client, defaultConfig);

      const schema = z.object({ name: z.string(), age: z.number() });
      const result = await agent.callChatStructured(
        [{ role: 'user', content: 'generate' }],
        schema,
      );

      expect(result).toEqual({ name: 'Alice', age: 25 });
    });

    it('should retry on parse failure', async () => {
      const client = {
        chatCompletion: vi
          .fn()
          .mockResolvedValueOnce({ content: 'not json' })
          .mockResolvedValueOnce({ content: 'still not json' })
          .mockResolvedValueOnce({ content: JSON.stringify({ ok: true }) }),
      } as unknown as LLMClient;

      const agent = new TestAgent(client, defaultConfig);
      const schema = z.object({ ok: z.boolean() });

      const result = await agent.callChatStructured(
        [{ role: 'user', content: 'generate' }],
        schema,
        3,
      );

      expect(result).toEqual({ ok: true });
      expect(client.chatCompletion).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const client = {
        chatCompletion: vi.fn().mockResolvedValue({ content: 'bad' }),
      } as unknown as LLMClient;

      const agent = new TestAgent(client, defaultConfig);
      const schema = z.object({ ok: z.boolean() });

      await expect(
        agent.callChatStructured(
          [{ role: 'user', content: 'generate' }],
          schema,
          2,
        ),
      ).rejects.toThrow('Failed to get structured output after retries');
    });
  });

  describe('chatWithToolsStream()', () => {
    const TOOLS: ToolDefinition[] = [
      { name: 'search_knowledge', description: '查知识库', parameters: { type: 'object', properties: {} } },
    ];

    /** 按顺序返回预设响应的 mock client */
    const mockClientSeq = (responses: ChatResult[]): { client: LLMClient; callCount: () => number } => {
      let i = 0;
      return {
        client: {
          supportsTools: true,
          chatCompletion: vi.fn(async () => {
            const r = responses[Math.min(i, responses.length - 1)];
            i++;
            return r;
          }),
          chatCompletionStream: async function* () {
            yield 'unused';
          },
        } as unknown as LLMClient,
        callCount: () => i,
      };
    };

    const collect = async (gen: AsyncGenerator<string>): Promise<string> => {
      const chunks: string[] = [];
      for await (const c of gen) chunks.push(c);
      return chunks.join('');
    };

    it('第1轮 toolCalls → 执行 → 第2轮输出最终回答', async () => {
      const { client } = mockClientSeq([
        { content: '', toolCalls: [{ id: 'c1', name: 'search_knowledge', arguments: '{"query":"张三"}' }] },
        { content: '这是基于检索的最终回答。' },
      ]);
      const executor = vi.fn(async () => JSON.stringify({ results: ['张三是主角'] }));
      const onToolCall = vi.fn();
      const agent = new TestAgent(client, defaultConfig);

      const out = await collect(agent.callChatWithTools([], TOOLS, executor, { onToolCall }));

      expect(executor).toHaveBeenCalledTimes(1);
      expect(executor.mock.calls[0][0].name).toBe('search_knowledge');
      expect(onToolCall).toHaveBeenCalledWith('search_knowledge', '{"query":"张三"}');
      expect(out).toBe('这是基于检索的最终回答。');
    });

    it('第1轮无 toolCalls → 直接输出,不执行工具', async () => {
      const { client } = mockClientSeq([{ content: '直接回答。' }]);
      const executor = vi.fn();
      const agent = new TestAgent(client, defaultConfig);
      const out = await collect(agent.callChatWithTools([], TOOLS, executor));
      expect(executor).not.toHaveBeenCalled();
      expect(out).toBe('直接回答。');
    });

    it('迭代上限用尽 → forceFinal 强制输出该轮 content', async () => {
      const { client, callCount } = mockClientSeq([
        { content: '', toolCalls: [{ id: 'c1', name: 'search_knowledge', arguments: '{}' }] },
        { content: '收敛回答。', toolCalls: [{ id: 'c2', name: 'search_knowledge', arguments: '{}' }] },
      ]);
      const executor = vi.fn(async () => '{"ok":true}');
      const agent = new TestAgent(client, defaultConfig);
      const out = await collect(agent.callChatWithTools([], TOOLS, executor, { maxIterations: 2 }));
      expect(callCount()).toBe(2);
      expect(executor).toHaveBeenCalledTimes(1);
      expect(out).toBe('收敛回答。');
    });

    it('executor 抛错 → 回填错误,循环继续到最终回答', async () => {
      const { client } = mockClientSeq([
        { content: '', toolCalls: [{ id: 'c1', name: 'search_knowledge', arguments: '{}' }] },
        { content: '兜底回答。' },
      ]);
      const executor = vi.fn(async () => {
        throw new Error('boom');
      });
      const agent = new TestAgent(client, defaultConfig);
      const out = await collect(agent.callChatWithTools([], TOOLS, executor));
      expect(out).toBe('兜底回答。');
    });
  });
});
