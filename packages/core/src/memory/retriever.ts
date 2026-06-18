import type { ChapterSummary, BatchSummary } from '../models/memory.js';
import type { Hook, OutlineNode } from '../models/knowledge.js';

/**
 * 远期记忆检索策略（G03-S06）
 *
 * 四套策略组合，产出可注入 Layer3 的远期记忆文本。见 tech-spec §5.6。
 * 1. 角色/地点关联 — 含关键词的章节摘要
 * 2. 伏笔驱动 — active 且沉默超阈值的伏笔优先回收
 * 3. 大纲指引 — 大纲中标注「回顾/呼应/伏笔」的节点
 * 4. 综合总结兜底 — 最近 2-3 个 BatchSummary
 */

/** 伏笔沉默判定阈值（章） */
const HOOK_DORMANT_THRESHOLD = 5;

export interface RetrievalInput {
  /** 当前涉及的角色/地点/物品关键词 */
  keywords: string[];
  /** 全部章节摘要 */
  summaries: ChapterSummary[];
  /** 伏笔列表 */
  hooks?: Hook[];
  /** 大纲节点（树状） */
  outline?: OutlineNode[];
  /** 综合总结（兜底） */
  batchSummaries?: BatchSummary[];
  /** 当前写到第几章（伏笔沉默判定基准） */
  currentChapter?: number;
  /** Layer3 token 预算上限 */
  maxTokens?: number;
}

/** 执行四策略检索，返回组装好的远期记忆文本 */
export function retrieveRemoteMemory(input: RetrievalInput): string {
  const {
    keywords,
    summaries,
    hooks = [],
    outline = [],
    batchSummaries = [],
    currentChapter = 0,
    maxTokens = 4000,
  } = input;
  const maxChars = maxTokens * 2;
  const parts: string[] = [];

  // 策略 1：角色/地点关联
  const kws = keywords.filter(Boolean);
  const related = kws.length
    ? summaries.filter((s) =>
        kws.some(
          (kw) =>
            s.charactersPresent.some((c) => c.includes(kw)) ||
            s.locationsUsed.some((l) => l.includes(kw)) ||
            s.plotEvents.some((e) => e.includes(kw)),
        ),
      )
    : [];
  if (related.length) {
    parts.push(
      '【相关章节回顾】\n' +
        related.slice(-5).map((s) => `第${s.chapter}章 ${s.title}：${s.plotOutcome}`).join('\n'),
    );
  }

  // 策略 2：伏笔驱动（active 且沉默超阈值，沉默久者优先）
  const dormant = hooks
    .filter((h) => h.status === 'active')
    .map((h) => ({ h, last: lastMentionChapter(h, summaries) }))
    .filter(({ last }) => currentChapter - last > HOOK_DORMANT_THRESHOLD)
    .sort((a, b) => a.last - b.last); // last 越小（越早）越优先
  if (dormant.length) {
    parts.push(
      '【待回收伏笔】\n' +
        dormant
          .slice(0, 5)
          .map(({ h }) => `「${h.name}」(沉默至第${currentChapter}章)：${h.description}`)
          .join('\n'),
    );
  }

  // 策略 3：大纲指引
  const guideNodes = flattenOutline(outline).filter((n) =>
    /回顾|呼应|伏笔|前文|之前|延续/.test(`${n.title} ${n.summary ?? ''}`),
  );
  if (guideNodes.length) {
    parts.push(
      '【大纲指引】\n' +
        guideNodes.slice(0, 3).map((n) => `• ${n.title}：${n.summary ?? ''}`).join('\n'),
    );
  }

  // 策略 4：综合总结兜底（最近 3 个）
  if (batchSummaries.length) {
    const recent = [...batchSummaries]
      .sort((a, b) => b.chapterRange[0] - a.chapterRange[0])
      .slice(0, 3);
    parts.push(
      '【近期综合总结】\n' +
        recent
          .map((b) => `第${b.chapterRange[0]}-${b.chapterRange[1]}章：${b.narrativeArc}`)
          .join('\n'),
    );
  }

  let text = parts.join('\n\n');
  if (text.length > maxChars) text = text.slice(0, maxChars) + '…';
  return text;
}

/** 伏笔最后一次被提及的章节（摘要 hooksAdvanced/hooksPlanted 匹配 name），无则用 plantedAt */
function lastMentionChapter(hook: Hook, summaries: ChapterSummary[]): number {
  const mentioned = summaries
    .filter((s) => s.hooksAdvanced.includes(hook.name) || s.hooksPlanted.includes(hook.name))
    .map((s) => s.chapter);
  return mentioned.length ? Math.max(...mentioned) : hook.plantedAt;
}

/** 展平大纲树（递归 children） */
function flattenOutline(nodes: OutlineNode[]): OutlineNode[] {
  const result: OutlineNode[] = [];
  for (const n of nodes) {
    result.push(n);
    if (n.children?.length) result.push(...flattenOutline(n.children));
  }
  return result;
}
