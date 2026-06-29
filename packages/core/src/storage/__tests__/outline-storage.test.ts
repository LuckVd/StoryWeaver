import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OutlineStorage } from '../outline-storage.js';
import { outlineLegacyFilePath } from '../path.js';
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
        id: 'a1',
        type: 'arc',
        title: '第一卷 初入修仙',
        summary: '主角踏入修仙世界',
        chapterRange: [1, 30],
        sortOrder: 0,
        children: [
          { id: 'm1', type: 'milestone', title: '觉醒灵根', summary: '获得修炼资质', sortOrder: 0 },
          { id: 'm2', type: 'milestone', title: '拜入宗门', summary: '入门', sortOrder: 1 },
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
    expect(tree!.children![0].type).toBe('arc');
    expect(tree!.children![0].chapterRange).toEqual([1, 30]);
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

  it('读到旧版结构(volume/chapter)归档为 legacy 并返回 null', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sw-outline-legacy-'));
    const st = new OutlineStorage(root);
    const legacyTree = {
      id: 'root',
      type: 'book',
      title: '旧书',
      sortOrder: 0,
      children: [
        {
          id: 'v1',
          type: 'volume',
          title: '第一卷',
          sortOrder: 0,
          children: [
            { id: 'ch1', type: 'chapter', title: '第一章', chapterId: 1, sortOrder: 0 },
          ],
        },
      ],
    } as unknown as OutlineNode;
    await st.write(legacyTree);

    // 旧结构 → read 归档为 outline.legacy.json,返回 null
    expect(await st.read()).toBeNull();
    expect(existsSync(outlineLegacyFilePath(root))).toBe(true);
    // 再次 read:outline.json 已不存在 → null(幂等,不重复归档)
    expect(await st.read()).toBeNull();

    rmSync(root, { recursive: true, force: true });
  });
});
