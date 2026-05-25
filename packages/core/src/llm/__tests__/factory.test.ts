import { describe, it, expect } from 'vitest';
import { createLLMClient, registerProvider } from '../factory.js';
import type { LLMClient, LLMProvider } from '../types.js';

describe('createLLMClient', () => {
  it('should create client for openai service', () => {
    const client = createLLMClient({
      id: 'gpt-4o',
      name: 'GPT-4o',
      service: 'openai',
      apiKey: 'test-key',
    });
    expect(client).toBeDefined();
    expect(typeof client.chatCompletion).toBe('function');
    expect(typeof client.chatCompletionStream).toBe('function');
  });

  it('should throw for unknown service', () => {
    expect(() =>
      createLLMClient({
        id: 'x',
        name: 'X',
        service: 'unknown-provider',
        apiKey: 'key',
      }),
    ).toThrow('Unknown LLM provider: "unknown-provider"');
  });

  it('should support registering custom providers', () => {
    const mockProvider: LLMProvider = {
      name: 'test-custom',
      createClient: () => ({
        chatCompletion: async () => ({ content: 'mock' }),
        chatCompletionStream: async function* () { yield 'mock'; },
      }),
    };

    registerProvider(mockProvider);

    const client = createLLMClient({
      id: 'test',
      name: 'Test',
      service: 'test-custom',
      apiKey: 'key',
    });

    expect(client).toBeDefined();
  });
});
