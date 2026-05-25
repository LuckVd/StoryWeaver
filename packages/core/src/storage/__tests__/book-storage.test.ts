import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BookStorage } from '../book-storage.js';
import type { Book } from '../../models/index.js';

describe('BookStorage', () => {
  let projectRoot: string;
  let storage: BookStorage;

  const sampleBook: Book = {
    title: '修仙大世界',
    genre: '玄幻',
    language: 'zh',
    status: 'in_progress',
    createdAt: '2026-05-24T10:00:00Z',
    updatedAt: '2026-05-24T10:00:00Z',
    nextChapterId: 1,
  };

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-book-test-'));
    storage = new BookStorage(projectRoot);
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('should return null when novel.yaml does not exist', async () => {
    expect(await storage.read()).toBeNull();
  });

  it('should return false for exists() when no file', () => {
    expect(storage.exists()).toBe(false);
  });

  it('should write and read back book data', async () => {
    await storage.write(sampleBook);
    const book = await storage.read();

    expect(book).not.toBeNull();
    expect(book!.title).toBe('修仙大世界');
    expect(book!.genre).toBe('玄幻');
    expect(book!.nextChapterId).toBe(1);
  });

  it('should return true for exists() after writing', () => {
    expect(storage.exists()).toBe(true);
  });

  it('should overwrite existing data', async () => {
    const updated: Book = { ...sampleBook, title: '新标题', nextChapterId: 10 };
    await storage.write(updated);
    const book = await storage.read();

    expect(book!.title).toBe('新标题');
    expect(book!.nextChapterId).toBe(10);
  });
});
