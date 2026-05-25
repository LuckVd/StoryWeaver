import { describe, it, expect } from 'vitest';
import { routeUserMessage } from '../router.js';

describe('routeUserMessage', () => {
  // 斜杠命令
  it('should route /write to writer', async () => {
    expect(await routeUserMessage('/write')).toBe('writer');
  });

  it('should route /audit to auditor', async () => {
    expect(await routeUserMessage('/audit')).toBe('auditor');
  });

  it('should route /brainstorm to brainstormer', async () => {
    expect(await routeUserMessage('/brainstorm')).toBe('brainstormer');
  });

  // 中文关键词 — writer
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

  // 英文关键词 — writer
  it('should route "continue" to writer', async () => {
    expect(await routeUserMessage('please continue the story')).toBe('writer');
  });

  it('should route "rewrite" to writer', async () => {
    expect(await routeUserMessage('rewrite paragraph 3')).toBe('writer');
  });

  // 审稿
  it('should route 审稿 to auditor', async () => {
    expect(await routeUserMessage('帮我审稿')).toBe('auditor');
  });

  it('should route "review" to auditor', async () => {
    expect(await routeUserMessage('review this chapter')).toBe('auditor');
  });

  // 构思
  it('should route 构思 to brainstormer', async () => {
    expect(await routeUserMessage('帮我构思一个新角色')).toBe('brainstormer');
  });

  it('should route 灵感 to brainstormer', async () => {
    expect(await routeUserMessage('给我一些灵感')).toBe('brainstormer');
  });

  // 知识库
  it('should route 角色设定 to curator', async () => {
    expect(await routeUserMessage('帮我整理角色设定')).toBe('curator');
  });

  it('should route 世界观 to curator', async () => {
    expect(await routeUserMessage('补充一下世界观')).toBe('curator');
  });

  // 总结
  it('should route 总结 to summarizer', async () => {
    expect(await routeUserMessage('总结这一章')).toBe('summarizer');
  });

  it('should route 摘要 to summarizer', async () => {
    expect(await routeUserMessage('生成摘要')).toBe('summarizer');
  });

  // 兜底
  it('should default to writer for unrecognized input', async () => {
    expect(await routeUserMessage('天气真好')).toBe('writer');
  });

  it('should handle empty-ish input as writer', async () => {
    expect(await routeUserMessage('  ')).toBe('writer');
  });
});
