import type { OutlineNode } from '../models/knowledge.js';

/** 后续规划卷软上限(①恒定档不截断,防极端膨胀;粗粒度大纲通常不触上限) */
const UPCOMING_LIMIT = 5;

/**
 * 大纲定位(纯函数)
 *
 * 将"当前写到第 N 章"映射到大纲里对应的剧情卷(arc),并给出其后若干卷(后续规划),
 * 供四档注入的①恒定档注入"前方剧情方向(往哪走)"。
 *
 * 依赖 arc 节点的 chapterRange([起,止?])做定位;结束章留空=进行中(视为 +∞)。
 * 未绑定 chapterRange 的卷(纯规划,起始/结束都未定)不参与 current 定位,但会作为
 * upcoming 暴露给 AI——这样"提前写多个未来卷"的方向能被 AI 看到、为后续铺路。
 * 无任何 arc → 返回 {current:null,upcoming:[]},调用方据此跳过。
 */

/** 当前卷定位结果 */
export interface ActiveArc {
  /** 当前章节所属的剧情卷(null=无任何卷) */
  current: OutlineNode | null;
  /** current 之后的若干卷(按 sortOrder,含未绑定章节的纯规划卷),供 AI 把控后续方向 */
  upcoming: OutlineNode[];
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
 * 定位当前章节所在的剧情卷及其后续规划卷。
 *
 * - 全部 arc(含未绑定)按 sortOrder 排序
 * - current:绑了起始章的卷中,取覆盖 currentChapter 的最后一个(无结束=进行中,覆盖到 +∞);
 *   无覆盖 → 最后一个 start<=ch 的卷(已写过的);无任何绑定卷 → 第一卷(纯规划)
 * - upcoming:current 之后的卷(含未绑定的纯规划卷),上限 UPCOMING_LIMIT
 * - 无 arc → {null, []}
 */
export function getActiveArc(root: OutlineNode | null, currentChapter: number): ActiveArc {
  const all = getArcsFlat(root);
  if (!all.length) return { current: null, upcoming: [] };

  const bound = all.filter((a) => a.chapterRange?.[0] != null);
  let currentIdx: number;
  if (bound.length) {
    // covering:起始 <= ch 且(无结束 或 ch <= 结束);无结束=进行中,覆盖到 +∞
    const covering = bound.filter((a) => {
      const [start, end] = a.chapterRange!;
      return start <= currentChapter && (end == null || currentChapter <= end);
    });
    if (covering.length) {
      // 多个覆盖(重叠)取最后一个(起始更靠后/更具体的卷);开放尾卷自然吞掉尾部
      currentIdx = all.indexOf(covering[covering.length - 1]);
    } else {
      // 无覆盖:已写过的最后一个卷(start <= ch),否则第一卷
      const started = bound.filter((a) => a.chapterRange![0] <= currentChapter);
      const cur = started.length ? started[started.length - 1] : bound[0];
      currentIdx = all.indexOf(cur);
    }
  } else {
    // 全部未绑定(纯规划)→ 第一卷作 current,其余作 upcoming
    currentIdx = 0;
  }

  const current = all[currentIdx];
  const upcoming = all.slice(currentIdx + 1, currentIdx + 1 + UPCOMING_LIMIT);
  return { current, upcoming };
}
