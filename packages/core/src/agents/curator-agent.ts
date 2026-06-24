import { z } from 'zod';
import type { LLMClient } from '../llm/types.js';
import type { Message, AgentConfig } from '../models/index.js';
import { BaseAgent } from './base-agent.js';
import { loadPrompt } from './prompts.js';

// ── Zod Schemas ──

const suggestedCharacterSchema = z.object({
  name: z.string(),
  description: z.string(),
  reason: z.string(),
});

const suggestedHookSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const suggestedWorldSchema = z.object({
  name: z.string(),
  category: z.string(),
  content: z.string(),
});

const suggestedEntitiesSchema = z.object({
  characters: z.array(suggestedCharacterSchema),
  hooks: z.array(suggestedHookSchema),
  worldEntries: z.array(suggestedWorldSchema),
});

export type SuggestedEntities = z.infer<typeof suggestedEntitiesSchema>;

// ── CuratorAgent ──

/**
 * Curator Agent — 知识库辅助（G03-S07）
 *
 * 阅读章节/对话内容，识别值得加入知识库的结构化实体（角色/伏笔/世界观）。
 * 低温度（0.3），准确提取。
 */
export class CuratorAgent extends BaseAgent {
  readonly name = 'curator' as const;
  private systemPrompt: string;

  constructor(client: LLMClient, config: AgentConfig, configDir?: string) {
    super(client, { ...config, temperature: config.temperature ?? 0.3 });
    this.systemPrompt = config.systemPrompt ?? loadPrompt('curator', configDir);
  }

  /**
   * 从文本中提取建议加入知识库的实体。
   *
   * @param messages 包含待分析文本的对话消息
   */
  async suggestEntities(messages: Message[]): Promise<SuggestedEntities> {
    const promptMessages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...messages,
      {
        role: 'user',
        content: buildSuggestPrompt(),
      },
    ];
    return this.chatStructured(promptMessages, suggestedEntitiesSchema);
  }

  /**
   * 对话式流式回复（自然语言设定整理）
   *
   * 与 suggestEntities（结构化 JSON）不同：本方法用于对话场景，作者在聊天里
   * 让 AI「整理设定 / 归纳角色 / 梳理世界观 / 补充设定建议」时，用自然语言流式回复。
   */
  async *curateStream(messages: Message[]): AsyncGenerator<string> {
    yield* this.chatStream([
      {
        role: 'system',
        content:
          '你是小说设定整理助手。根据作者需求，用自然语言梳理、归纳角色 / 世界观 / 力量体系 / 伏笔等已有设定，指出矛盾或缺漏并提出补充建议。要求分点清晰，基于已给出的信息。',
      },
      ...messages,
    ]);
  }
}

// ── Prompt 构建函数 ──

function buildSuggestPrompt(): string {
  return `请从以上内容中识别出值得加入知识库的实体，严格输出 JSON：

{
  "characters": [{ "name": "角色名", "description": "身份与特征简述", "reason": "为何值得记录" }],
  "hooks": [{ "name": "伏笔名", "description": "伏笔说明" }],
  "worldEntries": [{ "name": "条目名", "category": "geography|power-system|factions|history|glossary", "content": "内容" }]
}

要求：
1. 只提取确实重要、对后续写作有参考价值的实体，避免噪音
2. characters 记录出场且有戏份的角色
3. hooks 记录埋设的悬念
4. worldEntries 记录新出现的重要设定，归入合适分类
5. 只输出 JSON，不要输出其他内容`;
}
