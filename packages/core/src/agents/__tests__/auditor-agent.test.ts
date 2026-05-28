import { describe, it, expect, vi } from 'vitest';
import type { LLMClient, ChatResult } from '../../llm/types.js';
import type { AgentConfig } from '../../models/index.js';
import { AuditorAgent } from '../auditor-agent.js';

function createMockClient(result: ChatResult = { content: 'audit result' }) {
  return {
    chatCompletion: vi.fn().mockResolvedValue(result),
    chatCompletionStream: vi.fn().mockImplementation(async function* () {
      yield 'audit';
      yield ' stream';
    }),
  } as unknown as LLMClient;
}

const validReportJSON = JSON.stringify({
  overallScore: 7.5,
  scores: [
    { dimension: 'character_consistency', score: 8, weight: 0.2, comment: '角色一致' },
    { dimension: 'timeline', score: 7, weight: 0.15, comment: '时间线基本连贯' },
    { dimension: 'worldview', score: 8, weight: 0.15, comment: '世界观合规' },
    { dimension: 'hooks', score: 6, weight: 0.1, comment: '伏笔推进不足' },
    { dimension: 'pacing', score: 7, weight: 0.15, comment: '节奏适中' },
    { dimension: 'style', score: 8, weight: 0.15, comment: '风格一致' },
    { dimension: 'length', score: 8, weight: 0.1, comment: '篇幅合理' },
  ],
  issues: [
    { dimension: 'hooks', severity: 'medium', location: '第三段', description: '伏笔未推进', suggestion: '增加回扣' },
  ],
  summary: '整体质量不错，伏笔管理需加强。',
});

describe('AuditorAgent', () => {
  it('should inject auditor system prompt', async () => {
    const client = createMockClient();
    const agent = new AuditorAgent(client, { model: 'gpt-4o' });

    for await (const _ of agent.auditStream([{ role: 'user', content: '审稿这段内容' }])) {
      // consume stream
    }

    expect(client.chatCompletionStream).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('审稿'),
        }),
      ]),
      expect.any(Object),
    );
  });

  it('should use default temperature 0.3 for strict review', async () => {
    const client = createMockClient();
    const agent = new AuditorAgent(client, { model: 'gpt-4o' });

    // Just test the config was applied via a stream call
    for await (const _ of agent.auditStream([{ role: 'user', content: 'test' }])) {
      // consume stream
    }

    expect(client.chatCompletionStream).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ temperature: 0.3 }),
    );
  });

  it('should stream tokens via auditStream', async () => {
    const client = createMockClient();
    const agent = new AuditorAgent(client, { model: 'gpt-4o' });

    const tokens: string[] = [];
    for await (const token of agent.auditStream([
      { role: 'user', content: '审稿' },
    ])) {
      tokens.push(token);
    }

    expect(tokens).toEqual(['audit', ' stream']);
  });

  it('should produce structured ReviewReport via audit', async () => {
    const client = createMockClient({ content: validReportJSON });
    const agent = new AuditorAgent(client, { model: 'gpt-4o' });

    const report = await agent.audit([{ role: 'user', content: '审稿第1章' }], 1);

    expect(report.id).toBeDefined();
    expect(report.chapterId).toBe(1);
    expect(report.overallScore).toBe(7.5);
    expect(report.scores).toHaveLength(7);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].severity).toBe('medium');
    expect(report.summary).toBeDefined();
    expect(report.createdAt).toBeDefined();
  });

  it('should retry on invalid JSON from audit', async () => {
    const client = {
      chatCompletion: vi.fn()
        .mockResolvedValueOnce({ content: 'not json' })
        .mockResolvedValueOnce({ content: validReportJSON }),
    } as unknown as LLMClient;

    const agent = new AuditorAgent(client, { model: 'gpt-4o' });
    const report = await agent.audit([{ role: 'user', content: '审稿' }], 1);

    expect(report.overallScore).toBe(7.5);
    expect(client.chatCompletion).toHaveBeenCalledTimes(2);
  });

  it('should have name auditor', () => {
    const client = createMockClient();
    const agent = new AuditorAgent(client, { model: 'gpt-4o' });
    expect(agent.name).toBe('auditor');
  });
});
