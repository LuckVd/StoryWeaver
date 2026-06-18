import { describe, it, expect, vi } from 'vitest';
import type { LLMClient } from '../../llm/types.js';
import { CuratorAgent } from '../curator-agent.js';

function createMockClient(content: string) {
  return {
    chatCompletion: vi.fn().mockResolvedValue({ content }),
    chatCompletionStream: vi.fn(),
  } as unknown as LLMClient;
}

const validSuggestedJSON = JSON.stringify({
  characters: [{ name: '张三', description: '主角，剑修', reason: '核心角色' }],
  hooks: [{ name: '神秘符文', description: '主角身上的上古符文' }],
  worldEntries: [{ name: '天元宗', category: 'factions', content: '修仙宗门' }],
});

describe('CuratorAgent', () => {
  it('name 为 curator', () => {
    const agent = new CuratorAgent(createMockClient('x'), { model: 'gpt-4o' });
    expect(agent.name).toBe('curator');
  });

  it('提取建议实体（角色/伏笔/世界观）', async () => {
    const client = createMockClient(validSuggestedJSON);
    const agent = new CuratorAgent(client, { model: 'gpt-4o' });
    const result = await agent.suggestEntities([{ role: 'user', content: '章节内容' }]);
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].name).toBe('张三');
    expect(result.hooks[0].name).toBe('神秘符文');
    expect(result.worldEntries[0].category).toBe('factions');
  });

  it('注入 curator system prompt', async () => {
    const client = createMockClient(validSuggestedJSON);
    const agent = new CuratorAgent(client, { model: 'gpt-4o' });
    await agent.suggestEntities([{ role: 'user', content: '内容' }]);
    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Curator'),
        }),
      ]),
      expect.any(Object),
    );
  });

  it('默认温度 0.3', async () => {
    const client = createMockClient(validSuggestedJSON);
    const agent = new CuratorAgent(client, { model: 'gpt-4o' });
    await agent.suggestEntities([{ role: 'user', content: '内容' }]);
    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ temperature: 0.3 }),
    );
  });
});
