import { describe, it, expect, vi } from 'vitest';
import type { LLMClient, ChatOptions, ChatResult } from '../../llm/types.js';
import type { Message, AgentConfig } from '../../models/index.js';
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
});
