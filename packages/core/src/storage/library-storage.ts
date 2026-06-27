import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import type { Book, BookshelfItem } from '../models/index.js';
import { bookDir, currentBookFilePath, ensureDir, novelYamlPath } from './path.js';

/** slug 合法字符(纯 ASCII:字母/数字/下划线/连字符) */
const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

/** 新书需预建的顶层书级目录(memory/.cache 由 SqliteCache.openSync 自建) */
const BOOK_TOP_DIRS = ['volumes', 'knowledge', 'reviews', 'workspace'];

/**
 * 书架存储层 — 管理多本书的目录结构
 *
 * 书架根(libraryRoot,默认 ~/.storyweaver/books)下每本书一个子目录,
 * 子目录名即 slug,内含该书的完整数据(novel.yaml + volumes/ + knowledge/ + ...)。
 * 另维护 .current-book 指针记录当前打开的书。
 *
 * 单本书目录即该书的 projectRoot,所有现有 *Storage(path 已参数化)可零改动复用。
 */
export class LibraryStorage {
  constructor(private readonly libraryRoot: string) {}

  /** 单本书目录绝对路径 */
  bookPath(slug: string): string {
    return bookDir(this.libraryRoot, slug);
  }

  /** 该书的 novel.yaml 是否存在(= 书是否存在) */
  exists(slug: string): boolean {
    return existsSync(novelYamlPath(this.bookPath(slug)));
  }

  /** 列出书架所有书(按 updatedAt 倒序) */
  async list(): Promise<BookshelfItem[]> {
    await ensureDir(this.libraryRoot);
    let entries: import('node:fs').Dirent[];
    try {
      entries = await readdir(this.libraryRoot, { withFileTypes: true });
    } catch {
      return [];
    }
    const items: BookshelfItem[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !SLUG_RE.test(entry.name)) continue;
      const book = await this.readBook(entry.name);
      if (book) items.push(this.toItem(entry.name, book));
    }
    return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  /** 生成不冲突的新 slug(bk- + 6 位 base36 随机) */
  async generateSlug(): Promise<string> {
    const taken = new Set((await this.list()).map((i) => i.slug));
    let slug = '';
    do {
      slug = 'bk-' + Math.random().toString(36).slice(2, 8);
    } while (taken.has(slug));
    return slug;
  }

  /** 新建书:建目录(含顶层结构)+ 写 novel.yaml(slug 合法且唯一) */
  async createBook(slug: string, book: Book): Promise<void> {
    if (!SLUG_RE.test(slug)) {
      throw new Error('INVALID_SLUG');
    }
    if (this.exists(slug)) {
      throw new Error('BOOK_ALREADY_EXISTS');
    }
    const dir = this.bookPath(slug);
    await ensureDir(dir);
    for (const sub of BOOK_TOP_DIRS) {
      await ensureDir(join(dir, sub));
    }
    await writeFile(novelYamlPath(dir), stringify(book), 'utf-8');
  }

  /** 读某本书完整元数据(novel.yaml) */
  async readBook(slug: string): Promise<Book | null> {
    const yamlPath = novelYamlPath(this.bookPath(slug));
    if (!existsSync(yamlPath)) return null;
    try {
      return parse(await readFile(yamlPath, 'utf-8')) as Book;
    } catch {
      return null;
    }
  }

  /** 读取当前书 slug(指针不存在返回 null) */
  async getCurrent(): Promise<string | null> {
    const p = currentBookFilePath(this.libraryRoot);
    if (!existsSync(p)) return null;
    const slug = (await readFile(p, 'utf-8')).trim();
    return slug || null;
  }

  /** 写入当前书 slug 指针 */
  async setCurrent(slug: string): Promise<void> {
    await ensureDir(this.libraryRoot);
    await writeFile(currentBookFilePath(this.libraryRoot), slug, 'utf-8');
  }

  /** 更新指定书的元信息(合并 patch + 刷新 updatedAt + 持久化) */
  async updateBookMeta(
    slug: string,
    patch: Partial<Pick<Book, 'title' | 'author' | 'genre' | 'language' | 'status'>>,
  ): Promise<Book> {
    const book = await this.readBook(slug);
    if (!book) {
      throw new Error('BOOK_NOT_FOUND');
    }
    Object.assign(book, patch, { updatedAt: new Date().toISOString() });
    await writeFile(novelYamlPath(this.bookPath(slug)), stringify(book), 'utf-8');
    return book;
  }

  /** 删除一本书(整个目录,不可逆) */
  async deleteBook(slug: string): Promise<void> {
    if (!SLUG_RE.test(slug)) {
      throw new Error('INVALID_SLUG');
    }
    if (!this.exists(slug)) {
      throw new Error('BOOK_NOT_FOUND');
    }
    await rm(this.bookPath(slug), { recursive: true, force: true });
  }

  private toItem(slug: string, book: Book): BookshelfItem {
    return {
      slug,
      title: book.title,
      author: book.author,
      genre: book.genre,
      language: book.language,
      status: book.status,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      volumeCount: book.volumes?.length ?? 0,
    };
  }
}
