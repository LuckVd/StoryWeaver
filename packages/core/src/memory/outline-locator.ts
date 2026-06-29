import type { OutlineNode } from '../models/knowledge.js';

/**
 * 大纲定位(纯函数)
 *
 * 将"当前写到第 N 章"映射到大纲里对应的剧情卷(arc)及其下一卷,
 * 供四档注入的①恒定档注入"前方剧情方向(往哪走)"。
 *
 * 依赖 arc 节点的 chapterRange([起,止])做定位。无任何 arc 带 chapterRange →
 * 返回 {current:null,next:null}(不注入),调用方据此跳过。
 */

/** 当前卷定位结果 */
export interface ActiveArc {
  /** 当前章节所属的剧情卷(null=无法定位) */
  current: OutlineNode | null;
  /** 下一卷(方向预告) */
  next: OutlineNode | null;
}

/** 收集所有 type==='arc' 节点,按 sortOrder 升序 */
export function getArcsFlat(root: OutlineNode | null): OutlineNode[] {
  if (!root) return [];
  const out: OutlineNode[] = [];
  const walk = (n: OutlineNode): void => {
    if (n.type === 'arc') out.push(n);
    n.children?.forEach(walk);
  };
  walk(root);
  return out.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * 定位当前章节所在的剧情卷及其下一卷。
 *
 * - 精确:chapterRange 覆盖 currentChapter 的 arc → current,其后一个 → next
 * - fallback(落在间隙/已超过某卷范围但下一卷未起始):current = 最后一个
 *   range[0] <= currentChapter 的 arc(正在写的卷)
 * - fallback(currentChapter 早于所有 arc 起始):current = 第一个 arc
 * - 无 arc / 无任何 arc 带 chapterRange → {null, null}
 */
export function getActiveArc(root: OutlineNode | null, currentChapter: number): ActiveArc {
  const arcs = getArcsFlat(root).filter((a) => Array.isArray(a.chapterRange));
  if (!arcs.length) return { current: null, next: null };

  // 1. 精确:落在某 arc 的 [起,止] 内
  const hitIdx = arcs.findIndex(
    (a) => currentChapter >= a.chapterRange![0] && currentChapter <= a.chapterRange![1],
  );
  if (hitIdx !== -1) {
    return { current: arcs[hitIdx], next: arcs[hitIdx + 1] ?? null };
  }

  // 2. fallback:已跨过起始但落在间隙 → 最后一个 range[0] <= currentChapter 的 arc
  const started = arcs.filter((a) => currentChapter >= a.chapterRange![0]);
  if (started.length) {
    const cur = started[started.length - 1];
    const idx = arcs.indexOf(cur);
    return { current: cur, next: arcs[idx + 1] ?? null };
  }

  // 3. fallback:早于所有 arc 起始 → 第一卷
  return { current: arcs[0], next: arcs[1] ?? null };
}
