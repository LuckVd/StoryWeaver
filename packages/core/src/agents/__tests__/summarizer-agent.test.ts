import { describe, it, expect, vi } from 'vitest';
import type { LLMClient, ChatResult } from '../../llm/types.js';
import type { AgentConfig } from '../../models/index.js';
import { SummarizerAgent } from '../summarizer-agent.js';

function createMockClient(result: ChatResult = { content: 'summary result' }) {
  return {
    chatCompletion: vi.fn().mockResolvedValue(result),
    chatCompletionStream: vi.fn(),
  } as unknown as LLMClient;
}

const validChapterSummaryJSON = JSON.stringify({
  plotEvents: ['张三进入密室', '发现古阵法'],
  plotOutcome: '张三成功破解阵法获得传承',
  charactersPresent: ['张三', '李四'],
  characterActions: { '张三': '破解阵法', '李四': '在外守护' },
  newRevealedInfo: ['阵法为上古传承'],
  locationsUsed: ['密室'],
  hooksAdvanced: ['上古传承的线索'],
  hooksPlanted: ['阵法背后的秘密'],
  stateChanges: [{ entity: '张三', field: '修为', from: '金丹', to: '元婴' }],
  narrativeTime: '第三天清晨',
});

const validStoryStateJSON = JSON.stringify({
  currentArc: '张三获得上古传承',
  activeCharacters: ['张三', '李四'],
  currentLocation: '天元宗密室',
  recentEvents: ['张三进入密室', '破解阵法', '突破元婴'],
  openQuestions: ['阵法背后是谁布置的？'],
});

const validBatchSummaryJSON = JSON.stringify({
  narrativeArc: '张三从金丹突破元婴，获得上古传承',
  turningPoints: ['密室发现', '阵法破解'],
  characterDevelopment: { '张三': '金丹→元婴，获得上古传承' },
  unresolvedThreads: ['阵法背后的秘密'],
});

describe('SummarizerAgent', () => {
  it('should have name summarizer', () => {
    const client = createMockClient();
    const agent = new SummarizerAgent(client, { model: 'gpt-4o' });
    expect(agent.name).toBe('summarizer');
  });

  it('should use default temperature 0.3', async () => {
    const client = createMockClient({ content: validChapterSummaryJSON });
    const agent = new SummarizerAgent(client, { model: 'gpt-4o' });

    await agent.summarizeChapter(
      [{ role: 'user', content: '章节内容...' }],
      { chapter: 1, volume: 1, title: '第一章', wordCount: 2000 },
    );

    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ temperature: 0.3 }),
    );
  });

  it('should produce structured ChapterSummary', async () => {
    const client = createMockClient({ content: validChapterSummaryJSON });
    const agent = new SummarizerAgent(client, { model: 'gpt-4o' });

    const summary = await agent.summarizeChapter(
      [{ role: 'user', content: '章节内容...' }],
      { chapter: 1, volume: 1, title: '第一章', wordCount: 2000 },
    );

    expect(summary.chapter).toBe(1);
    expect(summary.volume).toBe(1);
    expect(summary.title).toBe('第一章');
    expect(summary.wordCount).toBe(2000);
    expect(summary.plotEvents).toHaveLength(2);
    expect(summary.charactersPresent).toContain('张三');
    expect(summary.stateChanges).toHaveLength(1);
    expect(summary.stateChanges[0].from).toBe('金丹');
    expect(summary.stateChanges[0].to).toBe('元婴');
    expect(summary.narrativeTime).toBe('第三天清晨');
  });

  it('should produce StoryStateSnapshot', async () => {
    const client = createMockClient({ content: validStoryStateJSON });
    const agent = new SummarizerAgent(client, { model: 'gpt-4o' });

    const state = await agent.updateStoryState([
      { role: 'user', content: '新发布的章节内容...' },
    ]);

    expect(state.currentArc).toBe('张三获得上古传承');
    expect(state.activeCharacters).toContain('张三');
    expect(state.currentLocation).toBe('天元宗密室');
    expect(state.recentEvents).toHaveLength(3);
    expect(state.openQuestions).toHaveLength(1);
    expect(state.updatedAt).toBeDefined();
  });

  it('should update StoryStateSnapshot incrementally', async () => {
    const client = createMockClient({ content: validStoryStateJSON });
    const agent = new SummarizerAgent(client, { model: 'gpt-4o' });

    const prevState = {
      lastPublishedChapter: 5,
      currentArc: '前期铺垫',
      activeCharacters: ['张三'],
      currentLocation: '天元宗',
      recentEvents: ['入门'],
      openQuestions: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const state = await agent.updateStoryState(
      [{ role: 'user', content: '第6章内容...' }],
      prevState,
    );

    // Should pass prevState context to LLM
    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('当前剧情状态'),
        }),
      ]),
      expect.any(Object),
    );

    expect(state.updatedAt).toBeDefined();
  });

  it('should produce BatchSummary', async () => {
    const client = createMockClient({ content: validBatchSummaryJSON });
    const agent = new SummarizerAgent(client, { model: 'gpt-4o' });

    const summary = await agent.summarizeBatch(
      [{ role: 'user', content: '多个章节摘要...' }],
      [1, 10],
      1,
    );

    expect(summary.chapterRange).toEqual([1, 10]);
    expect(summary.volume).toBe(1);
    expect(summary.narrativeArc).toContain('张三');
    expect(summary.turningPoints).toHaveLength(2);
    expect(summary.characterDevelopment).toHaveProperty('张三');
    expect(summary.unresolvedThreads).toHaveLength(1);
  });

  it('should retry on invalid JSON', async () => {
    const client = {
      chatCompletion: vi.fn()
        .mockResolvedValueOnce({ content: 'not json' })
        .mockResolvedValueOnce({ content: validChapterSummaryJSON }),
    } as unknown as LLMClient;

    const agent = new SummarizerAgent(client, { model: 'gpt-4o' });
    const summary = await agent.summarizeChapter(
      [{ role: 'user', content: '内容' }],
      { chapter: 1, volume: 1, title: '测试', wordCount: 100 },
    );

    expect(summary.plotEvents).toHaveLength(2);
    expect(client.chatCompletion).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exhausted', async () => {
    const client = {
      chatCompletion: vi.fn().mockResolvedValue({ content: 'always invalid' }),
    } as unknown as LLMClient;

    const agent = new SummarizerAgent(client, { model: 'gpt-4o' });

    await expect(
      agent.summarizeChapter(
        [{ role: 'user', content: '内容' }],
        { chapter: 1, volume: 1, title: '测试', wordCount: 100 },
      ),
    ).rejects.toThrow('Failed to get structured output after retries');
  });

  it('should inject summarizer system prompt', async () => {
    const client = createMockClient({ content: validChapterSummaryJSON });
    const agent = new SummarizerAgent(client, { model: 'gpt-4o' });

    await agent.summarizeChapter(
      [{ role: 'user', content: '内容' }],
      { chapter: 1, volume: 1, title: '测试', wordCount: 100 },
    );

    expect(client.chatCompletion).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('总结'),
        }),
      ]),
      expect.any(Object),
    );
  });
});
