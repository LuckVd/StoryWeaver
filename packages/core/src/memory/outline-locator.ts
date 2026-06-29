import type { OutlineNode } from '../models/knowledge.js';

/**
 * 大纲定位(纯函数)
 *
 * 将"当前写到第 N 章"映射到大纲里对应的剧情卷(arc)及其下一卷,
 * 供四档注入的①恒定档注入"前方剧情方向(往哪走)"。
 *
 * 依赖 arc 节点的 chapterRange([起,止?])做定位;结束章留空=进行中(视为 +∞)。
 * 无任何 arc 带起始章 → 返回 {current:null,next:null}(不注入),调用方据此跳过。
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
 * - 覆盖:start <= ch 且(end 空 或 ch <= end);end 空=进行中,覆盖到 +∞
 * - current = 最后一个覆盖 arc(开放尾卷自然吞掉尾部;重叠取更具体者)
 * - 无覆盖:current = 最后一个 start <= ch 的 arc(已写过的),否则第一个 arc
 * - 无 arc / 无任何 arc 带起始章 → {null, null}
 */
export function getActiveArc(root: OutlineNode | null, currentChapter: number): ActiveArc {
  // 参与 arc:有起始章即可(结束章可空=进行中)
  const arcs = getArcsFlat(root).filter((a) => a.chapterRange?.[0] != null);
  if (!arcs.length) return { current: null, next: null };

  // covering:起始 <= 当前章 且(无结束 或 当前章 <= 结束);无结束=进行中,覆盖到 +∞
  const covering = arcs.filter((a) => {
    const [start, end] = a.chapterRange!;
    return start <= currentChapter && (end == null || currentChapter <= end);
  });

  let current: OutlineNode;
  if (covering.length) {
    // 多个覆盖(重叠)时取最后一个(起始更靠后/更具体的卷);开放尾卷自然吞掉尾部
    current = covering[covering.length - 1];
  } else {
    // 无覆盖:已写过的最后一个卷(start <= ch),否则第一卷
    const started = arcs.filter((a) => a.chapterRange![0] <= currentChapter);
    current = started.length ? started[started.length - 1] : arcs[0];
  }

  const idx = arcs.indexOf(current);
  return { current, next: arcs[idx + 1] ?? null };
}
