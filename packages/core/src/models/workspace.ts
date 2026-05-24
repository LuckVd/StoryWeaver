/**
 * 工作区 (Workspace) 类型定义
 *
 * 系统全局唯一工作区，包含待创作/待发布的章节集合。
 * 发布后已发布章节移出，工作区继续复用。
 */

/** 工作区状态 */
export interface Workspace {
  /** 工作区中的章节 ID 列表 */
  chapterIds: number[];
  createdAt: string;
  updatedAt: string;
}
