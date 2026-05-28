import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OutlineStorage } from '../outline-storage.js';
import type { OutlineNode } from '../../models/index.js';

describe('OutlineStorage', () => {
  let projectRoot: string;
  let storage: OutlineStorage;

  const sampleTree: OutlineNode = {
    id: 'root',
    type: 'book',
    title: '修仙大世界',
    summary: '一部玄幻小说',
    sortOrder: 0,
    children: [
      {
        id: 'v1',
        type: 'volume',
        title: '第一卷 初入修仙',
        summary: '主角踏入修仙世界',
        sortOrder: 0,
        children: [
          { id: 'ch1', type: 'chapter', title: '第一章', summary: '开篇', chapterId: 1, sortOrder: 0 },
          { id: 'ch2', type: 'chapter', title: '第二章', summary: '入门', chapterId: 2, sortOrder: 1 },
        ],
      },
    ],
  };

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-outline-test-'));
    storage = new OutlineStorage(projectRoot);
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('should return null when no outline exists', async () => {
    expect(await storage.read()).toBeNull();
    expect(storage.exists()).toBe(false);
  });

  it('should write and read outline tree', async () => {
    await storage.write(sampleTree);
    expect(storage.exists()).toBe(true);

    const tree = await storage.read();
    expect(tree).not.toBeNull();
    expect(tree!.title).toBe('修仙大世界');
    expect(tree!.children).toHaveLength(1);
    expect(tree!.children![0].type).toBe('volume');
    expect(tree!.children![0].children).toHaveLength(2);
  });

  it('should overwrite outline', async () => {
    const updated: OutlineNode = {
      ...sampleTree,
      title: '新标题',
      children: [],
    };
    await storage.write(updated);

    const tree = await storage.read();
    expect(tree!.title).toBe('新标题');
    expect(tree!.children).toHaveLength(0);
  });
});
