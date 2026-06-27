import type { BookStatus } from './book.js';

/**
 * 书架(Bookshelf)类型定义
 *
 * 多书支持:书架根(默认 ~/.storyweaver/books)下每本书一个子目录,
 * BookshelfItem 是单本书在书架列表中的概览视图(slug + novel.yaml 精简字段)。
 */

/** 书架上一本书的概览 */
export interface BookshelfItem {
  /** 目录名(ASCII 短 id),作为书在书架内的唯一标识 */
  slug: string;
  title: string;
  author?: string;
  genre: string;
  language: string;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
  /** 卷数(来自 novel.yaml volumes 数组) */
  volumeCount: number;
}
