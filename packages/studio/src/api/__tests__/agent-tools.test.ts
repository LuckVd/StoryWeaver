import { describe, it, expect, vi } from 'vitest';
import { createToolExecutor, AGENT_TOOLS } from '../services/agent-tools.js';
import type { ToolCall } from '@storyweaver/core';

/* eslint-disable @typescript-eslint/no-explicit-any */

const mkCall = (name: string, args: object): ToolCall => ({
  id: 'c1',
  name,
  arguments: JSON.stringify(args),
});

function mockDeps(overrides: Record<string, any> = {}): any {
  return {
    searchEngine: { search: vi.fn(() => [] as any[]) },
    knowledgeService: {
      listHooks: vi.fn(async () => []),
      getOutline: vi.fn(async () => null),
    },
    summaryStorage: {
      getCharacterStates: vi.fn(async () => null),
      listChapterSummaries: vi.fn(async () => []),
    },
    projectRoot: '/tmp',
    ...overrides,
  };
}

describe('agent-tools', () => {
  it('AGENT_TOOLS 含 5 个工具', () => {
    expect(AGENT_TOOLS.map((t) => t.name)).toEqual([
      'search_knowledge',
      'get_character_history',
      'search_chapters',
      'get_hook_detail',
      'get_outline_node',
    ]);
  });

  it('search_knowledge 调 searchEngine.search(query, knowledge) 并返回结果', async () => {
    const se = { search: vi.fn(() => [{ title: '张三', snippet: '主角', score: 1 }]) };
    const executor = createToolExecutor(mockDeps({ searchEngine: se }));
    const r = await executor(mkCall('search_knowledge', { query: '张三' }));
    expect(se.search).toHaveBeenCalledWith('张三', 'knowledge');
    expect(JSON.parse(r).results[0].title).toBe('张三');
  });

  it('未知工具回填 error 不抛', async () => {
    const executor = createToolExecutor(mockDeps());
    const r = await executor(mkCall('unknown_tool', {}));
    expect(JSON.parse(r).error).toContain('未知工具');
  });

  it('参数 JSON 损坏不崩溃(降级为空 args)', async () => {
    const executor = createToolExecutor(mockDeps());
    const r = await executor({ id: 'c1', name: 'search_knowledge', arguments: '{bad' });
    expect(JSON.parse(r).results).toEqual([]);
  });

  it('get_hook_detail 按 status 过滤', async () => {
    const ks = {
      listHooks: vi.fn(async () => [
        { name: '伏笔A', status: 'active', description: 'd', plantedAt: 1 },
        { name: '伏笔B', status: 'resolved', description: 'd', plantedAt: 2 },
      ]),
      getOutline: vi.fn(async () => null),
    };
    const executor = createToolExecutor(mockDeps({ knowledgeService: ks }));
    const r = await executor(mkCall('get_hook_detail', { status: 'active' }));
    const parsed = JSON.parse(r);
    expect(parsed.hooks).toHaveLength(1);
    expect(parsed.hooks[0].name).toBe('伏笔A');
  });

  it('结果超长被截断(包装为合法 JSON)', async () => {
    const se = { search: vi.fn(() => [{ title: 'T', snippet: '字'.repeat(3000), score: 1 }]) };
    const executor = createToolExecutor(mockDeps({ searchEngine: se }));
    const r = await executor(mkCall('search_knowledge', { query: 'x' }));
    expect(r.length).toBeLessThan(3000);
    expect(JSON.parse(r).truncated).toBe(true); // 合法 JSON + truncated 标志
  });

  it('get_outline_node 无大纲时回 error', async () => {
    const executor = createToolExecutor(mockDeps());
    const r = await executor(mkCall('get_outline_node', { chapterId: 1 }));
    expect(JSON.parse(r).error).toBe('无大纲');
  });

  it('get_outline_node 传章节号返回当前卷+下一卷方向', async () => {
    const tree = {
      id: 'root',
      type: 'book',
      title: '书',
      sortOrder: 0,
      children: [
        { id: 'a1', type: 'arc', title: '第一卷', summary: '觉醒', chapterRange: [1, 14], sortOrder: 0 },
        { id: 'a2', type: 'arc', title: '第二卷', summary: '冲突', chapterRange: [15, 40], sortOrder: 1 },
      ],
    };
    const ks = { listHooks: vi.fn(async () => []), getOutline: vi.fn(async () => tree) };
    const executor = createToolExecutor(mockDeps({ knowledgeService: ks }));
    const r = await executor(mkCall('get_outline_node', { chapterId: 20 }));
    const parsed = JSON.parse(r);
    expect(parsed.current.title).toBe('第二卷');
    expect(parsed.next).toBeNull();
  });

  it('get_outline_node 不传章节号列出所有卷概要', async () => {
    const tree = {
      id: 'root',
      type: 'book',
      title: '书',
      sortOrder: 0,
      children: [
        { id: 'a1', type: 'arc', title: '第一卷', summary: '觉醒', chapterRange: [1, 14], sortOrder: 0 },
        { id: 'a2', type: 'arc', title: '第二卷', summary: '冲突', chapterRange: [15, 40], sortOrder: 1 },
      ],
    };
    const ks = { listHooks: vi.fn(async () => []), getOutline: vi.fn(async () => tree) };
    const executor = createToolExecutor(mockDeps({ knowledgeService: ks }));
    const r = await executor(mkCall('get_outline_node', {}));
    const parsed = JSON.parse(r);
    expect(parsed.arcs).toHaveLength(2);
    expect(parsed.arcs[0].title).toBe('第一卷');
  });
});
