import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { VersionStorage } from '../version-storage.js';
import { ChapterStorage } from '../chapter-storage.js';

describe('VersionStorage', () => {
  let projectRoot: string;
  let versionStorage: VersionStorage;
  let chapterStorage: ChapterStorage;

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-version-test-'));
    versionStorage = new VersionStorage();
    chapterStorage = new ChapterStorage(projectRoot);
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('should return empty list when no versions exist', async () => {
    const versions = await versionStorage.list(projectRoot, 1, 1);
    expect(versions).toEqual([]);
  });

  it('should create and read a version snapshot', async () => {
    await chapterStorage.writeChapter(1, 1, 'original content');

    const version = await versionStorage.write(projectRoot, 1, 1, {
      content: 'original content',
      trigger: 'save',
      description: '手动保存',
    });

    expect(version.id).toBe(1);
    expect(version.chapterId).toBe(1);
    expect(version.content).toBe('original content');
    expect(version.trigger).toBe('save');
    expect(version.description).toBe('手动保存');
    expect(version.wordCount).toBe('original content'.length);
    expect(typeof version.createdAt).toBe('string');
  });

  it('should auto-increment version IDs', async () => {
    const v2 = await versionStorage.write(projectRoot, 1, 1, {
      content: 'updated content',
      trigger: 'ai_apply',
      description: 'AI 应用',
    });
    expect(v2.id).toBe(2);
    expect(v2.content).toBe('updated content');
  });

  it('should list versions in descending order', async () => {
    const versions = await versionStorage.list(projectRoot, 1, 1);
    expect(versions.length).toBe(2);
    expect(versions[0].id).toBe(2);
    expect(versions[1].id).toBe(1);
  });

  it('should read a specific version by ID', async () => {
    const version = await versionStorage.read(projectRoot, 1, 1, 1);
    expect(version).not.toBeNull();
    expect(version!.content).toBe('original content');
  });

  it('should return null for non-existent version', async () => {
    const version = await versionStorage.read(projectRoot, 1, 1, 999);
    expect(version).toBeNull();
  });

  it('should delete a specific version', async () => {
    const deleted = await versionStorage.delete(projectRoot, 1, 1, 1);
    expect(deleted).toBe(true);
    const version = await versionStorage.read(projectRoot, 1, 1, 1);
    expect(version).toBeNull();
  });

  it('should return false when deleting non-existent version', async () => {
    const deleted = await versionStorage.delete(projectRoot, 1, 1, 999);
    expect(deleted).toBe(false);
  });

  it('should purge all versions', async () => {
    // Create a few versions for chapter 2
    await versionStorage.write(projectRoot, 1, 2, { content: 'a', trigger: 'save' });
    await versionStorage.write(projectRoot, 1, 2, { content: 'b', trigger: 'save' });

    await versionStorage.purgeAll(projectRoot, 1, 2);
    const versions = await versionStorage.list(projectRoot, 1, 2);
    expect(versions).toEqual([]);

    const dir = resolve(projectRoot, 'volumes/v01/ch002.versions');
    expect(existsSync(dir)).toBe(false);
  });

  it('should prune old versions when exceeding max', async () => {
    // Create 5 versions for chapter 3
    for (let i = 0; i < 5; i++) {
      await versionStorage.write(projectRoot, 1, 3, { content: `content ${i}`, trigger: 'save' });
    }

    // Prune to keep only 3
    await versionStorage.pruneOld(projectRoot, 1, 3, 3);

    const versions = await versionStorage.list(projectRoot, 1, 3);
    expect(versions.length).toBe(3);
    // Should keep newest 3: IDs 3, 4, 5
    expect(versions.map((v) => v.id).sort((a, b) => a - b)).toEqual([3, 4, 5]);
  });
});
