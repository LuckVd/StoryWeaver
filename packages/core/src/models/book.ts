/**
 * 书籍 (Book) 类型定义
 *
 * 对应 novel.yaml 顶层结构，每本小说一个 Book 实例。
 */

/** 书籍状态 */
export type BookStatus = 'drafting' | 'in_progress' | 'completed' | 'archived';

/** 卷宗元信息 */
export interface VolumeMeta {
  /** 卷号（1-based，作为唯一标识） */
  id: number;
  title: string;
  createdAt: string;
}

/** 书籍元信息（对应 novel.yaml） */
export interface Book {
  title: string;
  /** 作者(可选) */
  author?: string;
  genre: string;
  language: string;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
  /** 自增章节 ID 计数器 */
  nextChapterId: number;
  /** 自增卷号计数器 */
  nextVolumeId: number;
  /** 卷宗列表 */
  volumes: VolumeMeta[];
}
