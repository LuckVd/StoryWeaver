import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileWatcher } from '../services/file-watcher.js';
import { InMemorySearchEngine, type SSEEvent } from '@storyweaver/core';
import type { SSEEmitter } from '../sse.js';

// Mock chokidar
const handlers: Record<string, (...args: any[]) => void> = {};
vi.mock('chokidar', () => ({
  watch: vi.fn(() => ({
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers[event] = handler;
      return { on: vi.fn() };
    }),
    close: vi.fn(async () => {}),
  })),
}));

// Mock fs
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(async () => ''),
  },
}));

import fs from 'node:fs/promises';

function createMocks() {
  const searchEngine = new InMemorySearchEngine();
  const emitted: SSEEvent[] = [];
  const sseEmitter = {
    emit: vi.fn((event: SSEEvent) => emitted.push(event)),
    addListener: vi.fn(() => () => {}),
    listenerCount: 0,
  } as unknown as SSEEmitter;
  return { searchEngine, sseEmitter, emitted };
}

describe('FileWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
  });

  it('should register chokidar watchers on start', () => {
    const { searchEngine, sseEmitter } = createMocks();
    const watcher = new FileWatcher(searchEngine, sseEmitter, '/project');
    watcher.start();
    expect(handlers['add']).toBeDefined();
    expect(handlers['change']).toBeDefined();
    expect(handlers['unlink']).toBeDefined();
  });

  it('should close watcher on stop', async () => {
    const { searchEngine, sseEmitter } = createMocks();
    const watcher = new FileWatcher(searchEngine, sseEmitter, '/project');
    watcher.start();
    await watcher.stop();
    // stop should not throw
  });

  it('should handle chapter add event', async () => {
    const { searchEngine, sseEmitter, emitted } = createMocks();
    const watcher = new FileWatcher(searchEngine, sseEmitter, '/project');
    watcher.start();

    vi.mocked(fs.readFile).mockResolvedValueOnce('# 第一章 起点\n张三住在一个村庄里。');

    await handlers['add']('/project/volumes/v01/ch001.md');

    const results = searchEngine.search('起点');
    expect(results.length).toBeGreaterThan(0);
    expect(emitted[0]?.type).toBe('file:added');
  });

  it('should handle chapter change event', async () => {
    const { searchEngine, sseEmitter, emitted } = createMocks();
    searchEngine.indexChapter(1, '旧标题', '旧内容');
    const watcher = new FileWatcher(searchEngine, sseEmitter, '/project');
    watcher.start();

    vi.mocked(fs.readFile).mockResolvedValueOnce('# 第一章 新内容\n李四去了远方。');

    await handlers['change']('/project/volumes/v01/ch001.md');

    const results = searchEngine.search('新内容');
    expect(results.length).toBeGreaterThan(0);
    expect(emitted[0]?.type).toBe('file:changed');
  });

  it('should handle file unlink event', async () => {
    const { searchEngine, sseEmitter, emitted } = createMocks();
    searchEngine.indexChapter(1, '第一章', '张三的故事');
    const watcher = new FileWatcher(searchEngine, sseEmitter, '/project');
    watcher.start();

    await handlers['unlink']('/project/volumes/v01/ch001.md');

    const results = searchEngine.search('张三 故事');
    expect(results).toEqual([]);
    expect(emitted[0]?.type).toBe('file:removed');
  });

  it('should handle knowledge file change', async () => {
    const { searchEngine, sseEmitter, emitted } = createMocks();
    const watcher = new FileWatcher(searchEngine, sseEmitter, '/project');
    watcher.start();

    vi.mocked(fs.readFile).mockResolvedValueOnce(
      JSON.stringify({ name: '张三', description: '主角，修炼天才' }),
    );

    await handlers['add']('/project/knowledge/characters/char-zhangsan.json');

    const results = searchEngine.search('修炼天才');
    expect(results.length).toBeGreaterThan(0);
    expect(emitted[0]?.type).toBe('file:added');
  });

  it('should ignore unrecognized file paths', async () => {
    const { searchEngine, sseEmitter, emitted } = createMocks();
    const watcher = new FileWatcher(searchEngine, sseEmitter, '/project');
    watcher.start();

    await handlers['add']('/project/some/random/file.txt');

    expect(emitted.length).toBe(0);
  });

  it('should extract chapter title from markdown heading', async () => {
    const { searchEngine, sseEmitter } = createMocks();
    const watcher = new FileWatcher(searchEngine, sseEmitter, '/project');
    watcher.start();

    vi.mocked(fs.readFile).mockResolvedValueOnce('# 我的标题\n内容');

    await handlers['add']('/project/volumes/v01/ch001.md');

    const results = searchEngine.search('我的标题');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('我的标题');
  });
});
