import { z } from 'zod';
import type { LLMClient, ChatOptions } from '../llm/types.js';
import type { Message, AgentConfig } from '../models/index.js';
import type { ChapterSummary, BatchSummary, StoryStateSnapshot } from '../models/memory.js';
import { BaseAgent } from './base-agent.js';
import { loadPrompt } from './prompts.js';

// ── Zod Schemas ──

const chapterSummaryDataSchema = z.object({
  plotEvents: z.array(z.string()),
  plotOutcome: z.string(),
  charactersPresent: z.array(z.string()),
  characterActions: z.record(z.string()),
  newRevealedInfo: z.array(z.string()),
  locationsUsed: z.array(z.string()),
  hooksAdvanced: z.array(z.string()),
  hooksPlanted: z.array(z.string()),
  stateChanges: z.array(z.object({
    entity: z.string(),
    field: z.string(),
    from: z.string(),
    to: z.string(),
  })),
  narrativeTime: z.string().optional(),
});

const storyStateDataSchema = z.object({
  currentArc: z.string(),
  activeCharacters: z.array(z.string()),
  currentLocation: z.string(),
  recentEvents: z.array(z.string()),
  openQuestions: z.array(z.string()),
});

const batchSummaryDataSchema = z.object({
  narrativeArc: z.string(),
  turningPoints: z.array(z.string()),
  characterDevelopment: z.record(z.string()),
  unresolvedThreads: z.array(z.string()),
});

// ── SummarizerAgent ──

/**
 * Summarizer Agent — 章节摘要 / 剧情状态 / 综合总结
 *
 * 低温度（0.3），准确提取结构化信息。
 */
export class SummarizerAgent extends BaseAgent {
  readonly name = 'summarizer' as const;
  private systemPrompt: string;

  constructor(client: LLMClient, config: AgentConfig, configDir?: string) {
    super(client, { ...config, temperature: config.temperature ?? 0.3 });
    this.systemPrompt = config.systemPrompt ?? loadPrompt('summarizer', configDir);
  }

  /**
   * 生成章节摘要
   *
   * @param messages 包含章节文本的对话消息
   * @param meta 章节元数据（chapter/volume/title/wordCount）
   */
  async summarizeChapter(
    messages: Message[],
    meta: { chapter: number; volume: number; title: string; wordCount: number },
  ): Promise<ChapterSummary> {
    const promptMessages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...messages,
      {
        role: 'user',
        content: buildChapterSummaryPrompt(),
      },
    ];

    const data = await this.chatStructured(promptMessages, chapterSummaryDataSchema);

    return {
      chapter: meta.chapter,
      volume: meta.volume,
      title: meta.title,
      wordCount: meta.wordCount,
      ...data,
    };
  }

  /**
   * 更新剧情状态快照
   *
   * @param messages 包含最新发布章节的上下文
   * @param prevState 之前的状态（可选，用于增量更新）
   */
  async updateStoryState(
    messages: Message[],
    prevState?: StoryStateSnapshot | null,
  ): Promise<StoryStateSnapshot> {
    const context = prevState
      ? `当前剧情状态：\n${JSON.stringify(prevState, null, 2)}\n\n请根据以上新内容更新剧情状态。`
      : '这是首次生成剧情状态快照。';

    const promptMessages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...messages,
      {
        role: 'user',
        content: `${context}\n\n${buildStoryStatePrompt()}`,
      },
    ];

    const data = await this.chatStructured(promptMessages, storyStateDataSchema);

    return {
      ...data,
      lastPublishedChapter: prevState?.lastPublishedChapter ?? 0,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 生成多章综合总结
   *
   * @param messages 包含多个章节摘要的上下文
   * @param chapterRange 章节范围 [from, to]
   * @param volume 卷号
   */
  async summarizeBatch(
    messages: Message[],
    chapterRange: [number, number],
    volume: number,
  ): Promise<BatchSummary> {
    const promptMessages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...messages,
      {
        role: 'user',
        content: buildBatchSummaryPrompt(chapterRange),
      },
    ];

    const data = await this.chatStructured(promptMessages, batchSummaryDataSchema);

    return {
      chapterRange,
      volume,
      ...data,
    };
  }

  /**
   * 对话式流式回复（自然语言总结/回顾）
   *
   * 与 summarizeChapter（结构化 JSON）不同：本方法用于对话场景，作者在聊天里
   * 让 AI「总结这章 / 回顾前文 / 梳理线索」时，用自然语言流式回复。
   */
  async *summarizeStream(messages: Message[]): AsyncGenerator<string> {
    yield* this.chatStream([
      {
        role: 'system',
        content:
          '你是小说总结助手。根据作者需求，用自然语言回顾、总结指定内容（某章情节、前文剧情线、某角色线索、伏笔进展等）。要求清晰有条理、分点呈现，只基于已给出的信息，不编造未提及的内容。',
      },
      ...messages,
    ]);
  }

  /**
   * 压缩早期对话为摘要（C4，对话 >10 轮时调用）
   *
   * @param messages 含已压缩摘要（可选，作为首条 user）+ 待压缩的早期对话消息
   * @returns 压缩后的纯文本摘要（≤300 字）
   */
  async compressDialog(messages: Message[]): Promise<string> {
    return this.chat([
      {
        role: 'system',
        content:
          '你是对话压缩助手。把以下作者与 AI 助手的早期对话压缩成简洁摘要，保留：已确定的创作决策、已写入/修改的内容要点、尚未解决的问题；丢弃寒暄与重复。直接输出纯文本摘要，不超过 300 字。',
      },
      ...messages,
    ]);
  }
}

// ── Prompt 构建函数 ──

function buildChapterSummaryPrompt(): string {
  return `请对以上章节内容生成结构化摘要，输出严格 JSON 格式：

{
  "plotEvents": ["事件1", "事件2"],
  "plotOutcome": "一句话结果",
  "charactersPresent": ["出场角色"],
  "characterActions": { "角色名": "该角色做了什么" },
  "newRevealedInfo": ["新揭示的信息"],
  "locationsUsed": ["涉及地点"],
  "hooksAdvanced": ["推进的伏笔"],
  "hooksPlanted": ["新埋的伏笔"],
  "stateChanges": [{ "entity": "实体名", "field": "属性", "from": "之前", "to": "之后" }],
  "narrativeTime": "故事内时间（可选）"
}

要求：
1. plotEvents 每条不超过 30 字，列出关键情节
2. plotOutcome 用一句话概括本章结果
3. characterActions 记录每个出场角色的主要行动
4. stateChanges 记录角色修为、关系、状态等变化
5. 只输出 JSON，不要输出其他内容`;
}

function buildStoryStatePrompt(): string {
  return `请根据以上内容生成/更新剧情状态快照，输出严格 JSON 格式：

{
  "currentArc": "当前故事弧概述（100字以内）",
  "activeCharacters": ["当前活跃角色列表"],
  "currentLocation": "故事当前发生地",
  "recentEvents": ["最近3-5个关键事件（每条20字以内）"],
  "openQuestions": ["当前悬而未决的问题"]
}

要求：
1. currentArc 简明概括当前主线
2. activeCharacters 列出近期出场的核心角色
3. recentEvents 按时间顺序列出关键事件
4. openQuestions 列出尚未解决的悬念
5. 只输出 JSON，不要输出其他内容`;
}

function buildBatchSummaryPrompt(range: [number, number]): string {
  return `请根据以上第 ${range[0]}-${range[1]} 章的摘要内容，生成多章综合总结，输出严格 JSON 格式：

{
  "narrativeArc": "核心剧情线（500字以内）",
  "turningPoints": ["关键转折点"],
  "characterDevelopment": { "角色名": "角色发展描述" },
  "unresolvedThreads": ["未解决的问题"]
}

要求：
1. narrativeArc 完整概括这段章节的核心剧情
2. turningPoints 列出所有重大转折
3. characterDevelopment 记录每个角色的成长变化
4. unresolvedThreads 收集所有未解决的伏笔和悬念
5. 只输出 JSON，不要输出其他内容`;
}
