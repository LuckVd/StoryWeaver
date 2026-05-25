import { describe, it, expect, vi } from 'vitest';
import type { LLMClient, ChatResult } from '../../llm/types.js';
import type { AgentConfig } from '../../models/index.js';
import { WriterAgent } from '../writer-agent.js';

function createMockClient(result: ChatResult = { content: 'written content' }) {
  return {
    chatCompletion: vi.fn().mockResolvedValue(result),
    chatCompletionStream: vi.fn().mockImplementation(async function* () {
      yield 'written';
      yield ' content';
    }),
  } as unknown as LLMClient;
}

const defaultConfig: AgentConfig = {
  model: 'gpt-4o',
  temperature: 0.8,
};

describe('WriterAgent', () => {
  it('should inject system prompt and call chat', async () => {
    const client = createMockClient();
    const agent = new WriterAgent(client, defaultConfig);

    const result = await agent.write([
      { role: 'user', content: '续写下一段' },
    ]);

    expect(result).toBe('written content');
    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Writer'),
        }),
        expect.objectContaining({ role: 'user', content: '续写下一段' }),
      ]),
      expect.any(Object),
    );
  });

  it('should use custom system prompt from config', async () => {
    const client = createMockClient();
    const config: AgentConfig = {
      model: 'gpt-4o',
      systemPrompt: 'Custom writer prompt',
    };
    const agent = new WriterAgent(client, config);

    await agent.write([{ role: 'user', content: 'test' }]);

    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: 'Custom writer prompt',
        }),
      ]),
      expect.any(Object),
    );
  });

  it('should stream tokens via writeStream', async () => {
    const client = createMockClient();
    const agent = new WriterAgent(client, defaultConfig);

    const tokens: string[] = [];
    for await (const token of agent.writeStream([
      { role: 'user', content: '续写' },
    ])) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['written', ' content']);
    expect(client.chatCompletionStream).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: '续写' }),
      ]),
      expect.any(Object),
    );
  });

  it('should pass model and temperature to LLMClient', async () => {
    const client = createMockClient();
    const agent = new WriterAgent(client, defaultConfig);

    await agent.write([{ role: 'user', content: 'test' }]);

    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ model: 'gpt-4o', temperature: 0.8 }),
    );
  });
});
