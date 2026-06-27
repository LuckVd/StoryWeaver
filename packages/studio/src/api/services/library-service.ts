import { LibraryStorage, ChapterStorage, VolumeIndexStorage, VersionStorage, type Book, type BookshelfItem } from '@storyweaver/core';
import { ChapterService } from './chapter-service.js';

/**
 * 书架业务逻辑层
 *
 * 协调 LibraryStorage:列出/新建书、读取当前书指针。
 * 切书(重建 server 容器)由 server 层的 switchBook 负责,本层只管书架数据。
 */
export class LibraryService {
  constructor(private readonly libraryStorage: LibraryStorage) {}

  /** 列出书架所有书(按 updatedAt 倒序) */
  list(): Promise<BookshelfItem[]> {
    return this.libraryStorage.list();
  }

  /** 新建书:生成 slug + 建目录 + 写 novel.yaml */
  async create(input: { title: string; author?: string; genre: string; language: string }): Promise<{ slug: string; book: Book }> {
    const slug = await this.libraryStorage.generateSlug();
    const now = new Date().toISOString();
    const book: Book = {
      title: input.title,
      author: input.author,
      genre: input.genre,
      language: input.language,
      status: 'drafting',
      createdAt: now,
      updatedAt: now,
      nextChapterId: 1,
      nextVolumeId: 1,
      volumes: [],
    };
    await this.libraryStorage.createBook(slug, book);
    return { slug, book };
  }

  /** 书是否存在 */
  exists(slug: string): boolean {
    return this.libraryStorage.exists(slug);
  }

  /** 读某本书完整元数据 */
  readBook(slug: string): Promise<Book | null> {
    return this.libraryStorage.readBook(slug);
  }

  /** 当前书 slug 指针(无则 null) */
  getCurrent(): Promise<string | null> {
    return this.libraryStorage.getCurrent();
  }

  /** 单本书目录绝对路径 */
  bookPath(slug: string): string {
    return this.libraryStorage.bookPath(slug);
  }

  /** 更新指定书的元信息(书架编辑,不依赖当前打开的书) */
  updateBookMeta(
    slug: string,
    patch: Partial<Pick<Book, 'title' | 'author' | 'genre' | 'language' | 'status'>>,
  ): Promise<Book> {
    return this.libraryStorage.updateBookMeta(slug, patch);
  }

  /** 删除一本书;返回是否删的是当前书 + fallback(下一本 slug,无则 null) */
  async deleteBook(slug: string): Promise<{ wasCurrent: boolean; fallback: string | null }> {
    const current = await this.libraryStorage.getCurrent();
    const wasCurrent = current === slug;
    await this.libraryStorage.deleteBook(slug);
    if (wasCurrent) {
      const remaining = await this.libraryStorage.list();
      return { wasCurrent, fallback: remaining[0]?.slug ?? null };
    }
    return { wasCurrent, fallback: null };
  }

  /**
   * 写作活跃聚合(跨书架所有书):每章字数归到其 updatedAt 那天,按天累加。
   * 返回近 days 天(含 0 字日)的升序序列。
   * 近似口径:多天写的章节归到最后更新日(系统无逐日字数日志)。
   */
  async getActivity(days = 364): Promise<{ date: string; words: number }[]> {
    const books = await this.libraryStorage.list();
    const byDay = new Map<string, number>();
    for (const b of books) {
      const dir = this.libraryStorage.bookPath(b.slug);
      const cs = new ChapterService(
        new VolumeIndexStorage(dir),
        new ChapterStorage(dir),
        new VersionStorage(),
        dir,
      );
      const metas = await cs.list();
      for (const m of metas) {
        if (!m.updatedAt) continue;
        const vol = await cs.findVolume(m.id);
        if (vol == null) continue;
        const ch = await cs.read(vol, m.id);
        if (!ch) continue;
        const wc = ch.content.replace(/<[^>]+>/g, '').length;
        const day = m.updatedAt.slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + wc);
      }
    }
    const result: { date: string; words: number }[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, words: byDay.get(key) ?? 0 });
    }
    return result;
  }
}
