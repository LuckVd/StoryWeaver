import { describe, it, expect, vi } from 'vitest';
import { routeUserMessage } from '../router.js';
import type { LLMClient } from '../../llm/types.js';

function createMockClient(response: string) {
  return {
    chatCompletion: vi.fn().mockResolvedValue({ content: response }),
    chatCompletionStream: vi.fn(),
  } as unknown as LLMClient;
}

describe('routeUserMessage', () => {
  // ── 斜杠命令 ──

  it('should route /write to writer', async () => {
    expect(await routeUserMessage('/write')).toBe('writer');
  });

  it('should route /audit to auditor', async () => {
    expect(await routeUserMessage('/audit')).toBe('auditor');
  });

  it('should route /brainstorm to brainstormer', async () => {
    expect(await routeUserMessage('/brainstorm')).toBe('brainstormer');
  });

  it('should route /summarize to summarizer', async () => {
    expect(await routeUserMessage('/summarize')).toBe('summarizer');
  });

  it('should route /curate to curator', async () => {
    expect(await routeUserMessage('/curate')).toBe('curator');
  });

  // ── 中文关键词 — writer ──

  it('should route 续写 to writer', async () => {
    expect(await routeUserMessage('帮我续写下一段')).toBe('writer');
  });

  it('should route 继续写 to writer', async () => {
    expect(await routeUserMessage('继续写下去')).toBe('writer');
  });

  it('should route 改写 to writer', async () => {
    expect(await routeUserMessage('改写第三段')).toBe('writer');
  });

  it('should route 润色 to writer', async () => {
    expect(await routeUserMessage('润色一下这段')).toBe('writer');
  });

  it('should route 展开 to writer', async () => {
    expect(await routeUserMessage('展开这个场景')).toBe('writer');
  });

  it('should route 删掉 to writer', async () => {
    expect(await routeUserMessage('删掉这段')).toBe('writer');
  });

  // ── 英文关键词 — writer ──

  it('should route "continue" to writer', async () => {
    expect(await routeUserMessage('please continue the story')).toBe('writer');
  });

  it('should route "rewrite" to writer', async () => {
    expect(await routeUserMessage('rewrite paragraph 3')).toBe('writer');
  });

  it('should route "expand" to writer', async () => {
    expect(await routeUserMessage('expand this scene')).toBe('writer');
  });

  // ── 审稿 ──

  it('should route 审稿 to auditor', async () => {
    expect(await routeUserMessage('帮我审稿')).toBe('auditor');
  });

  it('should route "review" to auditor', async () => {
    expect(await routeUserMessage('review this chapter')).toBe('auditor');
  });

  it('should route 比较 to auditor', async () => {
    expect(await routeUserMessage('比较这两段')).toBe('auditor');
  });

  it('should route 挑错 to auditor', async () => {
    expect(await routeUserMessage('帮我挑错')).toBe('auditor');
  });

  // ── 构思 ──

  it('should route 构思 to brainstormer', async () => {
    expect(await routeUserMessage('帮我构思一个新角色')).toBe('brainstormer');
  });

  it('should route 灵感 to brainstormer', async () => {
    expect(await routeUserMessage('给我一些灵感')).toBe('brainstormer');
  });

  it('should route 建议 to brainstormer', async () => {
    expect(await routeUserMessage('给我一些写作建议')).toBe('brainstormer');
  });

  // ── 知识库 ──

  it('should route 角色设定 to curator', async () => {
    expect(await routeUserMessage('帮我整理角色设定')).toBe('curator');
  });

  it('should route 世界观 to curator', async () => {
    expect(await routeUserMessage('补充一下世界观')).toBe('curator');
  });

  // ── 总结 ──

  it('should route 总结 to summarizer', async () => {
    expect(await routeUserMessage('总结这一章')).toBe('summarizer');
  });

  it('should route 摘要 to summarizer', async () => {
    expect(await routeUserMessage('生成摘要')).toBe('summarizer');
  });

  it('should route 回顾 to summarizer', async () => {
    expect(await routeUserMessage('回顾一下前面的剧情')).toBe('summarizer');
  });

  // ── 兜底（无 LLM）──

  it('should default to writer for unrecognized input', async () => {
    expect(await routeUserMessage('天气真好')).toBe('writer');
  });

  it('should handle empty-ish input as writer', async () => {
    expect(await routeUserMessage('  ')).toBe('writer');
  });

  // ── LLM 兜底 ──

  it('should use LLM fallback when provided', async () => {
    const client = createMockClient('auditor');
    const result = await routeUserMessage('这段话有什么问题吗', undefined, client);
    expect(result).toBe('auditor');
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it('should fall back to writer on LLM error', async () => {
    const client = {
      chatCompletion: vi.fn().mockRejectedValue(new Error('LLM failed')),
    } as unknown as LLMClient;
    const result = await routeUserMessage('不太确定要做什么', undefined, client);
    expect(result).toBe('writer');
  });

  it('should fall back to writer on LLM timeout', async () => {
    const client = {
      chatCompletion: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
    } as unknown as LLMClient;
    const result = await routeUserMessage('慢慢来', undefined, client);
    expect(result).toBe('writer');
  }, 10000);

  it('should fall back to writer on unrecognized LLM response', async () => {
    const client = createMockClient('不确定');
    const result = await routeUserMessage('随便聊聊', undefined, client);
    expect(result).toBe('writer');
  });

  it('should not call LLM when keyword matches', async () => {
    const client = createMockClient('brainstormer');
    const result = await routeUserMessage('帮我续写', undefined, client);
    expect(result).toBe('writer'); // keyword match takes priority
    expect(client.chatCompletion).not.toHaveBeenCalled();
  });

  it('should still work without LLM client (backward compatible)', async () => {
    const result = await routeUserMessage('一些模糊的话');
    expect(result).toBe('writer');
  });
});
