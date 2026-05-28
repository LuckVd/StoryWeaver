import { describe, it, expect, vi } from 'vitest';
import type { LLMClient, ChatResult } from '../../llm/types.js';
import type { AgentConfig } from '../../models/index.js';
import { BrainstormerAgent } from '../brainstormer-agent.js';

function createMockClient(result: ChatResult = { content: 'brainstorm result' }) {
  return {
    chatCompletion: vi.fn().mockResolvedValue(result),
    chatCompletionStream: vi.fn().mockImplementation(async function* () {
      yield 'brainstorm';
      yield ' result';
    }),
  } as unknown as LLMClient;
}

describe('BrainstormerAgent', () => {
  it('should inject brainstormer system prompt', async () => {
    const client = createMockClient();
    const agent = new BrainstormerAgent(client, { model: 'gpt-4o' });

    await agent.brainstorm([{ role: 'user', content: '构思一个修仙设定' }]);

    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('构思'),
        }),
      ]),
      expect.any(Object),
    );
  });

  it('should use default temperature 1.0 for creativity', async () => {
    const client = createMockClient();
    const agent = new BrainstormerAgent(client, { model: 'gpt-4o' });

    await agent.brainstorm([{ role: 'user', content: 'test' }]);

    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ temperature: 1.0 }),
    );
  });

  it('should allow temperature override', async () => {
    const client = createMockClient();
    const agent = new BrainstormerAgent(client, { model: 'gpt-4o', temperature: 0.9 });

    await agent.brainstorm([{ role: 'user', content: 'test' }]);

    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ temperature: 0.9 }),
    );
  });

  it('should stream tokens via brainstormStream', async () => {
    const client = createMockClient();
    const agent = new BrainstormerAgent(client, { model: 'gpt-4o' });

    const tokens: string[] = [];
    for await (const token of agent.brainstormStream([
      { role: 'user', content: '构思' },
    ])) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['brainstorm', ' result']);
  });

  it('should use custom system prompt', async () => {
    const client = createMockClient();
    const agent = new BrainstormerAgent(client, {
      model: 'gpt-4o',
      systemPrompt: 'Custom brainstorm prompt',
    });

    await agent.brainstorm([{ role: 'user', content: 'test' }]);

    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system', content: 'Custom brainstorm prompt' }),
      ]),
      expect.any(Object),
    );
  });

  it('should have name brainstormer', () => {
    const client = createMockClient();
    const agent = new BrainstormerAgent(client, { model: 'gpt-4o' });
    expect(agent.name).toBe('brainstormer');
  });
});
