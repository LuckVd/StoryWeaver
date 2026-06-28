import type { OutlineNode } from '../models/knowledge.js';

/**
 * 大纲定位(纯函数)
 *
 * 将"当前写到第 N 章"映射到大纲里对应的 chapter 节点及其前后相邻节点,
 * 供四档注入的①恒定档注入"这章按计划该写什么"。见注入升级方案。
 *
 * 依赖 OutlineNode.chapterId(仅 chapter 节点)做精确关联。
 * 兜底:chapterId 缺失 / 不匹配 → 返回 null(不做标题解析,大纲标题与正文标题不可靠),
 * 调用方据此跳过大纲部分注入。
 */

/** 相邻节点定位结果 */
export interface OutlineNeighbors {
  /** 当前章节对应的大纲节点(null 表示无法定位) */
  current: OutlineNode | null;
  /** 前若干章的大纲节点(按 sortOrder 升序) */
  before: OutlineNode[];
  /** 后若干章的大纲节点(按 sortOrder 升序) */
  after: OutlineNode[];
}

/** 收集所有 type==='chapter' 节点,按 sortOrder 升序 */
export function getChapterNodesFlat(root: OutlineNode | null): OutlineNode[] {
  if (!root) return [];
  const out: OutlineNode[] = [];
  const walk = (n: OutlineNode): void => {
    if (n.type === 'chapter') out.push(n);
    n.children?.forEach(walk);
  };
  walk(root);
  return out.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** 按 chapterId 精确查找 chapter 节点;未设/不匹配返回 null */
export function findOutlineNodeByChapterId(
  root: OutlineNode | null,
  chapterId: number,
): OutlineNode | null {
  if (!root) return null;
  let found: OutlineNode | null = null;
  const walk = (n: OutlineNode): boolean => {
    if (n.type === 'chapter' && n.chapterId === chapterId) {
      found = n;
      return true;
    }
    return (n.children ?? []).some(walk);
  };
  walk(root);
  return found;
}

/**
 * 定位当前章节节点及其前后相邻节点(按 sortOrder)。
 * 当前章 chapterId 不在大纲中 → current=null, before/after 为空。
 */
export function getOutlineNeighbors(
  root: OutlineNode | null,
  chapterId: number,
  before = 1,
  after = 1,
): OutlineNeighbors {
  const flat = getChapterNodesFlat(root);
  const idx = flat.findIndex((n) => n.chapterId === chapterId);
  if (idx === -1) return { current: null, before: [], after: [] };
  return {
    current: flat[idx],
    before: flat.slice(Math.max(0, idx - before), idx),
    after: flat.slice(idx + 1, idx + 1 + after),
  };
}
