import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../openai-provider.js';
import type { LLMClient } from '../types.js';

// Mock openai 模块
const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: { create: mockCreate },
    },
  })),
}));

describe('OpenAIProvider', () => {
  let client: LLMClient;
  const provider = new OpenAIProvider();

  beforeEach(() => {
    vi.clearAllMocks();
    client = provider.createClient('test-api-key', 'https://api.test.com');
  });

  it('should have name "openai"', () => {
    expect(provider.name).toBe('openai');
  });

  describe('chatCompletion', () => {
    it('should call OpenAI API and return content + usage', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hello, world!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      const result = await client.chatCompletion(
        [{ role: 'user', content: 'Hi' }],
        { model: 'gpt-4o', temperature: 0.7 },
      );

      expect(result.content).toBe('Hello, world!');
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });

    it('should return empty string for null content', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
        usage: undefined,
      });

      const result = await client.chatCompletion([{ role: 'user', content: 'Hi' }]);
      expect(result.content).toBe('');
      expect(result.usage).toBeUndefined();
    });

    it('should retry on retryable errors (429)', async () => {
      class RateLimitError extends Error {
        status = 429;
      }

      mockCreate
        .mockRejectedValueOnce(new RateLimitError('Rate limited'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success after retry' } }],
          usage: undefined,
        });

      const result = await client.chatCompletion([{ role: 'user', content: 'Hi' }]);
      expect(result.content).toBe('Success after retry');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should retry on server errors (500)', async () => {
      class ServerError extends Error {
        status = 500;
      }

      mockCreate
        .mockRejectedValueOnce(new ServerError('Internal error'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'OK' } }],
          usage: undefined,
        });

      const result = await client.chatCompletion([{ role: 'user', content: 'Hi' }]);
      expect(result.content).toBe('OK');
    });

    it('should not retry on non-retryable errors (400)', async () => {
      class BadRequestError extends Error {
        status = 400;
      }

      mockCreate.mockRejectedValue(new BadRequestError('Bad request'));

      await expect(
        client.chatCompletion([{ role: 'user', content: 'Hi' }]),
      ).rejects.toThrow('Bad request');

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exhausted', async () => {
      class ServerDownError extends Error {
        status = 503;
      }

      mockCreate.mockRejectedValue(new ServerDownError('Server down'));

      await expect(
        client.chatCompletion([{ role: 'user', content: 'Hi' }]),
      ).rejects.toThrow('Server down');

      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('chatCompletionStream', () => {
    it('should yield tokens from stream', async () => {
      async function* mockStream() {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ', ' } }] };
        yield { choices: [{ delta: { content: 'world!' } }] };
      }

      mockCreate.mockResolvedValue(mockStream());

      const tokens: string[] = [];
      for await (const token of client.chatCompletionStream(
        [{ role: 'user', content: 'Hi' }],
      )) {
        tokens.push(token);
      }

      expect(tokens).toEqual(['Hello', ', ', 'world!']);
    });

    it('should skip empty deltas', async () => {
      async function* mockStream() {
        yield { choices: [{ delta: { content: 'A' } }] };
        yield { choices: [{ delta: { content: undefined } }] };
        yield { choices: [{ delta: {} }] };
        yield { choices: [{ delta: { content: 'B' } }] };
      }

      mockCreate.mockResolvedValue(mockStream());

      const tokens: string[] = [];
      for await (const token of client.chatCompletionStream(
        [{ role: 'user', content: 'Hi' }],
      )) {
        tokens.push(token);
      }

      expect(tokens).toEqual(['A', 'B']);
    });
  });
});
