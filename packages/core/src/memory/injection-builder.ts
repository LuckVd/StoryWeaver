import type { Rule, Hook, OutlineNode } from '../models/knowledge.js';
import type {
  StoryStateSnapshot,
  ChapterSummary,
  CharacterStates,
  BatchSummary,
} from '../models/memory.js';
import type { ActiveArc } from './outline-locator.js';
import { getModelContextWindow } from './token-budget.js';
import { retrieveRemoteMemory } from './retriever.js';
import type { InMemorySearchEngine } from '../search/index.js';

/** 输出 token 预留(给 AI 生成) */
const OUTPUT_RESERVE = 4000;

/** 当前章信息(② 的尾部正文由调用方截好) */
export interface InjectionChapter {
  id: number;
  title: string;
  volumeTitle?: string;
  contentTail: string;
}

/** buildInjection 输入 */
export interface InjectionInput {
  model: string;
  /** Agent systemPrompt(可选;agent.writeStream 已自动注入人格,通常不传以避免重复) */
  systemPrompt?: string;
  /** 当前章(null=未绑定章节) */
  chapter: InjectionChapter | null;
  /** 大纲当前剧情卷 + 下一卷(① 前方规划) */
  activeArc: ActiveArc;
  /** 强制规则(①,全量不截断) */
  rules: Rule[];
  /** Layer1 剧情状态快照(①) */
  storyState: StoryStateSnapshot | null;
  /** 搜索引擎(③ 检索设定;可选) */
  searchEngine?: InMemorySearchEngine;
  /** 当前章实体关键词(③ 检索 query + 远期检索 keywords) */
  entities: string[];
  /** 章节摘要(③ 相关历史 + ④ 填充) */
  summaries: ChapterSummary[];
  /** 伏笔(③ 待回收) */
  hooks: Hook[];
  /** 综合总结(③ 兜底) */
  batchSummaries?: BatchSummary[];
  /** 角色状态(③) */
  characterStates?: CharacterStates | null;
  /** 对话历史字符数(预算 D) */
  dialogChars: number;
  /** 当前章节号(伏笔沉默判定基准) */
  currentChapter: number;
}

/** 四档注入结果 */
export interface InjectionResult {
  /** ① 恒定(规则/大纲导航/状态,不截断) */
  constant: string;
  /** ② 当前章上下文(正文尾部) */
  chapterContext: string;
  /** ③ 相关性检索(设定/伏笔/历史章节/角色状态) */
  retrieved: string;
  /** ④ 预算填充(近章摘要) */
  budgetFill: string;
  budget: InjectionBudget;
}

export interface InjectionBudget {
  total: number;
  constant: number;
  chapterContext: number;
  retrieved: number;
  budgetFill: number;
}

/** 估算上下文占用(按字符数,中文标点全计入)。
 *  全程统一字符单位,与 dialogChars/truncate 一致;模型窗口(token)直接作字符预算
 *  (中文 1 字≈1 token,作安全上界;英文偏保守,不会溢出)。*/
function estimateChars(text: string): number {
  return text.length;
}

/** 按字符截断(保留前部 + 省略号) */
function truncate(text: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)) + '…';
}

/**
 * 全局预算协调:四档共享窗口,优先级 ①>②>③>④。
 * ① 恒定不压;剩余 R = 窗口 − ① − 输出预留 − 对话;②=R·0.2,③=R'·0.6,④=剩余。
 * 溢出从 ④ 开始丢,① 绝不丢。见注入升级方案。
 */
export function coordinateBudget(
  model: string,
  constantChars: number,
  dialogChars: number,
): InjectionBudget {
  const total = getModelContextWindow(model);
  let remaining = Math.max(0, total - constantChars - OUTPUT_RESERVE - dialogChars);
  const chapterContext = Math.floor(remaining * 0.2);
  remaining = Math.max(0, remaining - chapterContext);
  const retrieved = Math.floor(remaining * 0.6);
  remaining = Math.max(0, remaining - retrieved);
  return { total, constant: constantChars, chapterContext, retrieved, budgetFill: remaining };
}

/** 组装四档注入文本 */
export function buildInjection(input: InjectionInput): InjectionResult {
  const constant = buildConstant(input);
  const budget = coordinateBudget(input.model, estimateChars(constant), input.dialogChars);

  const chapterContext = input.chapter
    ? truncate(buildChapterContext(input.chapter), budget.chapterContext)
    : '';
  const retrieved = truncate(buildRetrieved(input), budget.retrieved);
  const budgetFill = truncate(buildBudgetFill(input.summaries), budget.budgetFill);

  return { constant, chapterContext, retrieved, budgetFill, budget };
}

// ── ① 恒定(不截断) ──
function buildConstant(input: InjectionInput): string {
  const parts: string[] = [];
  if (input.systemPrompt) parts.push(input.systemPrompt);

  // 规则(全量,按优先级 high→low)
  if (input.rules.length) {
    const prio: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = [...input.rules].sort(
      (a, b) => (prio[a.priority] ?? 9) - (prio[b.priority] ?? 9),
    );
    parts.push(
      '【强制规则(必须遵守)】\n' +
        sorted.map((r) => `- [${r.priority}] ${r.name}:${r.content}`).join('\n'),
    );
  }

  const arcText = formatArcDirection(input.activeArc);
  if (arcText) parts.push(arcText);

  if (input.storyState) parts.push(formatStoryState(input.storyState));

  return parts.filter(Boolean).join('\n\n');
}

function formatArcDirection(a: ActiveArc): string {
  if (!a.current) return '';
  const fmt = (n: OutlineNode, tag: string): string => {
    const range = n.chapterRange
      ? n.chapterRange[1] == null
        ? `(第${n.chapterRange[0]}章起·进行中)`
        : `(第${n.chapterRange[0]}-${n.chapterRange[1]}章)`
      : '';
    return `[${tag}] ${n.title}${range}\n  方向: ${n.summary ?? ''}`;
  };
  const lines: string[] = ['【剧情方向(前方规划)】'];
  lines.push(fmt(a.current, '当前卷'));
  if (a.next) lines.push(fmt(a.next, '下一卷'));
  return lines.join('\n');
}

function formatStoryState(s: StoryStateSnapshot): string {
  return [
    '【剧情状态】',
    `当前主线:${s.currentArc}`,
    `活跃角色:${s.activeCharacters.join('、')}`,
    `当前地点:${s.currentLocation}`,
    s.recentEvents.length ? `最近事件:${s.recentEvents.map((e) => `「${e}」`).join(' ')}` : '',
    s.openQuestions.length ? `悬而未决:${s.openQuestions.map((q) => `「${q}」`).join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ── ② 当前章上下文 ──
function buildChapterContext(ch: InjectionChapter): string {
  const header = ch.volumeTitle
    ? `第${ch.id}章「${ch.title}」(${ch.volumeTitle})`
    : `第${ch.id}章「${ch.title}」`;
  return `${header}\n已有正文(尾部,接续点):\n${ch.contentTail}`;
}

// ── ③ 相关性检索 ──
function buildRetrieved(input: InjectionInput): string {
  const parts: string[] = [];

  // 相关知识库设定(按当前章实体检索,替代旧的全量注入)
  if (input.searchEngine && input.entities.length) {
    const hits = input.searchEngine.search(input.entities.join(' '), 'knowledge').slice(0, 8);
    if (hits.length) {
      parts.push('【相关设定】\n' + hits.map((h) => `- ${h.title}:${h.snippet}`).join('\n'));
    }
  }

  // 远期记忆:相关章节回顾 / 待回收伏笔 / 综合总结(大纲方向已在①恒定档,此处不重复)
  const remote = retrieveRemoteMemory({
    keywords: input.entities,
    summaries: input.summaries,
    hooks: input.hooks,
    batchSummaries: input.batchSummaries ?? [],
    currentChapter: input.currentChapter,
    maxTokens: 4000,
  });
  if (remote) parts.push(remote);

  // 角色状态史
  if (input.characterStates && input.characterStates.characters.length) {
    parts.push(formatCharacterStates(input.characterStates));
  }

  return parts.filter(Boolean).join('\n\n');
}

function formatCharacterStates(cs: CharacterStates): string {
  return (
    '【角色当前状态】\n' +
    cs.characters
      .map(
        (c) =>
          `${c.entity}:${Object.entries(c.currentState)
            .map(([k, v]) => `${k}=${v}`)
            .join(',')}`,
      )
      .join('\n')
  );
}

// ── ④ 预算填充(近章摘要,近→远,truncate 保留最近) ──
function buildBudgetFill(summaries: ChapterSummary[]): string {
  if (!summaries.length) return '';
  const sorted = [...summaries].sort((a, b) => b.chapter - a.chapter).slice(0, 20);
  return (
    '【近期章节摘要】\n' +
    sorted.map((s) => `第${s.chapter}章 ${s.title}:${s.plotOutcome}`).join('\n')
  );
}
