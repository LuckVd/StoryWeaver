import type {
  TokenBudget,
  StoryStateSnapshot,
  ChapterSummary,
  CharacterStates,
} from '../models/memory.js';
import { buildTokenBudget } from './token-budget.js';

/**
 * 三层记忆上下文组装（G03-S01）
 *
 * 将永久/近期/远期记忆组装成可注入 AI Prompt 的文本，并按 Token 预算截断。
 * 见 tech-spec §5.2 / §5.8。
 *
 * Layer3 优先使用检索策略（G03-S06）注入的 remoteRetrieved；
 * 若未提供，则用 timeline / characterStates 兜底（保证远期记忆非空）。
 */

/** 组装结果 */
export interface MemoryContext {
  /** Layer 1 永久记忆（核心设定 + 剧情状态快照） */
  layer1: string;
  /** Layer 2 近期记忆（最近 N 章摘要） */
  layer2: string;
  /** Layer 3 远期记忆（检索结果或兜底派生视图） */
  layer3: string;
  /** Token 预算分配 */
  budget: TokenBudget;
  /** 各层估算 token 数 */
  estimatedTokens: { layer1: number; layer2: number; layer3: number };
}

export interface BuildMemoryContextOptions {
  model: string;
  storyState?: StoryStateSnapshot | null;
  recentSummaries?: ChapterSummary[];
  characterStates?: CharacterStates | null;
  /** 核心设定文本（角色/世界观/写作规则，由调用方从知识库组装） */
  coreSettings?: string;
  /** G03-S06 检索策略注入的远期内容；未提供则用派生视图兜底 */
  remoteRetrieved?: string;
  /** Layer2 取最近几章，默认 5 */
  recentChapterCount?: number;
  /** 对话历史估算 token 数 */
  dialogHistoryTokens?: number;
}

// TODO(G03 精化): 接入精确 tokenizer（如 tiktoken）。当前按中文估算：约 1 汉字 ≈ 1 token
// （英文偏高估，但中文小说场景下是合理且偏安全的上界，避免长篇记忆注入溢出上下文窗口）。
const CHARS_PER_TOKEN = 1;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** 按预算截断文本（超长则保留前部 + 省略号） */
function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '…';
}

export function buildMemoryContext(options: BuildMemoryContextOptions): MemoryContext {
  const {
    model,
    storyState = null,
    recentSummaries = [],
    characterStates = null,
    coreSettings = '',
    remoteRetrieved,
    recentChapterCount = 5,
    dialogHistoryTokens = 3500,
  } = options;

  const budget = buildTokenBudget(model, { dialogHistory: dialogHistoryTokens });

  // Layer 1：核心设定 + 剧情状态快照
  const stateText = storyState ? formatStoryState(storyState) : '';
  const layer1Raw = [coreSettings, stateText].filter(Boolean).join('\n\n');
  const layer1 = truncateToTokens(layer1Raw, budget.layer1);

  // Layer 2：最近 N 章摘要（按章节号取最大 N 章，再升序输出）
  const recent = [...recentSummaries]
    .sort((a, b) => b.chapter - a.chapter)
    .slice(0, recentChapterCount)
    .sort((a, b) => a.chapter - b.chapter);
  const layer2Raw = recent.map(formatChapterSummary).join('\n\n');
  const layer2 = truncateToTokens(layer2Raw, budget.layer2);

  // Layer 3：S06 检索结果优先，否则 characterStates 兜底
  let layer3Raw = remoteRetrieved ?? '';
  if (!layer3Raw) {
    layer3Raw = formatStates(characterStates);
  }
  const layer3 = truncateToTokens(layer3Raw, budget.layer3);

  return {
    layer1,
    layer2,
    layer3,
    budget,
    estimatedTokens: {
      layer1: estimateTokens(layer1),
      layer2: estimateTokens(layer2),
      layer3: estimateTokens(layer3),
    },
  };
}

function formatStoryState(s: StoryStateSnapshot): string {
  return [
    '【剧情状态】',
    `当前主线：${s.currentArc}`,
    `活跃角色：${s.activeCharacters.join('、')}`,
    `当前地点：${s.currentLocation}`,
    `最近事件：\n${s.recentEvents.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}`,
    s.openQuestions.length ? `悬而未决：${s.openQuestions.map((q) => `「${q}」`).join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatChapterSummary(s: ChapterSummary): string {
  return [
    `第${s.chapter}章 ${s.title}${s.narrativeTime ? `（${s.narrativeTime}）` : ''}`,
    `情节：${s.plotEvents.join('；')}`,
    `结果：${s.plotOutcome}`,
  ].join('\n');
}

function formatStates(states: CharacterStates | null): string {
  if (!states || !states.characters.length) return '';
  return (
    '【角色当前状态】\n' +
    states.characters
      .map(
        (c) =>
          `${c.entity}：${Object.entries(c.currentState)
            .map(([k, v]) => `${k}=${v}`)
            .join('，')}`,
      )
      .join('\n')
  );
}
