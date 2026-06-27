import { BookStorage, type Book, type VolumeMeta } from '@storyweaver/core';

/**
 * 书籍业务逻辑层
 *
 * 封装 BookStorage 操作，管理全局书籍状态和卷宗列表。
 */
export class BookService {
  constructor(
    private readonly bookStorage: BookStorage,
  ) {}

  /** 初始化新书 */
  async create(input: { title: string; author?: string; genre: string; language: string }): Promise<Book> {
    if (this.bookStorage.exists()) {
      throw new Error('BOOK_ALREADY_EXISTS');
    }
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
    await this.bookStorage.write(book);
    return book;
  }

  /** 获取书籍信息 */
  async read(): Promise<Book | null> {
    return this.bookStorage.read();
  }

  /** 更新书籍信息 */
  async update(patch: Partial<Pick<Book, 'title' | 'author' | 'genre' | 'language' | 'status'>>): Promise<Book> {
    const book = await this.bookStorage.read();
    if (!book) {
      throw new Error('BOOK_NOT_FOUND');
    }
    Object.assign(book, patch, { updatedAt: new Date().toISOString() });
    await this.bookStorage.write(book);
    return book;
  }

  /** 添加卷宗（内部方法，供 ChapterService 调用） */
  async addVolume(title: string): Promise<{ volumeId: number; book: Book }> {
    const book = await this.bookStorage.read();
    if (!book) {
      throw new Error('BOOK_NOT_FOUND');
    }
    const volumeId = book.nextVolumeId;
    const now = new Date().toISOString();
    const volume: VolumeMeta = { id: volumeId, title, createdAt: now };
    book.volumes.push(volume);
    book.nextVolumeId = volumeId + 1;
    book.updatedAt = now;
    await this.bookStorage.write(book);
    return { volumeId, book };
  }

  /** 更新卷标题 */
  async updateVolume(volumeId: number, title: string): Promise<Book> {
    const book = await this.bookStorage.read();
    if (!book) {
      throw new Error('BOOK_NOT_FOUND');
    }
    const volume = book.volumes.find((v) => v.id === volumeId);
    if (!volume) {
      throw new Error('VOLUME_NOT_FOUND');
    }
    volume.title = title;
    book.updatedAt = new Date().toISOString();
    await this.bookStorage.write(book);
    return book;
  }

  /** 分配下一个章节 ID（原子自增） */
  async allocateChapterId(): Promise<{ chapterId: number; book: Book }> {
    const book = await this.bookStorage.read();
    if (!book) {
      throw new Error('BOOK_NOT_FOUND');
    }
    const chapterId = book.nextChapterId;
    book.nextChapterId = chapterId + 1;
    book.updatedAt = new Date().toISOString();
    await this.bookStorage.write(book);
    return { chapterId, book };
  }
}
