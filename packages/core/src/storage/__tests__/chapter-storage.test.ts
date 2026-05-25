import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ChapterStorage } from '../chapter-storage.js';

describe('ChapterStorage', () => {
  let projectRoot: string;
  let storage: ChapterStorage;

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-chapter-test-'));
    storage = new ChapterStorage(projectRoot);
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('should return null for non-existent chapter', async () => {
    expect(await storage.readChapter(1, 1)).toBeNull();
  });

  it('should write and read back chapter content', async () => {
    const content = '# 第一章\\n\\n这是正文内容。';
    await storage.writeChapter(1, 1, content);
    const result = await storage.readChapter(1, 1);

    expect(result).toBe(content);
  });

  it('should auto-create volume directory', () => {
    expect(existsSync(resolve(projectRoot, 'volumes/v01'))).toBe(true);
  });

  it('should list chapters in a volume', async () => {
    await storage.writeChapter(1, 3, 'ch3');
    await storage.writeChapter(1, 1, 'ch1');
    await storage.writeChapter(1, 2, 'ch2');

    const chapters = await storage.listChapters(1);
    expect(chapters).toEqual([1, 2, 3]);
  });

  it('should return empty array for non-existent volume', async () => {
    const chapters = await storage.listChapters(99);
    expect(chapters).toEqual([]);
  });

  it('should list volumes', async () => {
    await storage.writeChapter(3, 1, 'v3');
    await storage.writeChapter(2, 1, 'v2');

    const volumes = await storage.listVolumes();
    expect(volumes).toEqual([1, 2, 3]);
  });

  it('should return empty array when no volumes dir', async () => {
    const freshRoot = mkdtempSync(join(tmpdir(), 'sw-empty-'));
    const freshStorage = new ChapterStorage(freshRoot);
    expect(await freshStorage.listVolumes()).toEqual([]);
    rmSync(freshRoot, { recursive: true, force: true });
  });

  it('should delete a chapter', async () => {
    await storage.writeChapter(1, 10, 'to-delete');
    const deleted = await storage.deleteChapter(1, 10);
    expect(deleted).toBe(true);
    expect(await storage.readChapter(1, 10)).toBeNull();
  });

  it('should return false when deleting non-existent chapter', async () => {
    const deleted = await storage.deleteChapter(1, 999);
    expect(deleted).toBe(false);
  });
});
