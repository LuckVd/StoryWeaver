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

/** 写作规则(对齐 Rule 模型,精简字段,不含 id/timestamp) */
const suggestedRuleSchema = z.object({
  category: z.enum(['style', 'taboo', 'narrative_perspective', 'custom']),
  name: z.string(),
  content: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
});

/** 基础提取 schema(角色/伏笔/世界观);rules 为 optional 以保持对 summary-service 的向后兼容 */
const suggestedEntitiesSchema = z.object({
  characters: z.array(suggestedCharacterSchema),
  hooks: z.array(suggestedHookSchema),
  worldEntries: z.array(suggestedWorldSchema),
  rules: z.array(suggestedRuleSchema).optional(),
});

export type SuggestedEntities = z.infer<typeof suggestedEntitiesSchema>;

/** 完整提取 schema(4 类,rules 必填)——知识库「AI 智能录入」入口使用 */
const suggestedEntitiesFullSchema = suggestedEntitiesSchema.extend({
  rules: z.array(suggestedRuleSchema),
});

export type SuggestedEntitiesFull = z.infer<typeof suggestedEntitiesFullSchema>;

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
   * 从文本中提取建议加入知识库的实体(角色/伏笔/世界观)。
   * 章节自动提取链路(summary-service)使用,保持 3 类输出。
   *
   * @param messages 包含待分析文本的对话消息
   */
  async suggestEntities(messages: Message[]): Promise<SuggestedEntities> {
    const promptMessages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...messages,
      {
        role: 'user',
        content: buildSuggestPrompt(false),
      },
    ];
    return this.chatStructured(promptMessages, suggestedEntitiesSchema);
  }

  /**
   * 从文本中提取建议加入知识库的实体(角色/伏笔/世界观/规则 4 类)。
   * 知识库「AI 智能录入」入口使用,额外覆盖写作规则。
   */
  async suggestEntitiesWithRules(messages: Message[]): Promise<SuggestedEntitiesFull> {
    const promptMessages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...messages,
      {
        role: 'user',
        content: buildSuggestPrompt(true),
      },
    ];
    return this.chatStructured(promptMessages, suggestedEntitiesFullSchema);
  }
}

// ── Prompt 构建函数 ──

function buildSuggestPrompt(includeRules = false): string {
  const head = `请从以上内容中识别出值得加入知识库的实体，严格输出 JSON：

{
  "characters": [{ "name": "角色名", "description": "身份与特征简述", "reason": "为何值得记录" }],
  "hooks": [{ "name": "伏笔名", "description": "伏笔说明" }],
  "worldEntries": [{ "name": "条目名", "category": "geography|power-system|factions|history|glossary", "content": "内容" }]`;
  const rulesEntry = `,
  "rules": [{ "category": "style|taboo|narrative_perspective|custom", "name": "规则名", "content": "规则内容", "priority": "high|medium|low" }]`;
  const tail = `

要求：
1. 只提取确实重要、对后续写作有参考价值的实体，避免噪音
2. characters 记录出场且有戏份的角色
3. hooks 记录埋设的悬念
4. worldEntries 记录新出现的重要设定，归入合适分类`;
  const rulesReq = includeRules
    ? '\n5. rules 记录贯穿全书的写作约束/禁忌/叙事视角约定(文风、禁用词汇、人称视角等),归入合适分类与优先级\n6. 只输出 JSON，不要输出其他内容'
    : '\n5. 只输出 JSON，不要输出其他内容';
  return `${head}${includeRules ? rulesEntry : ''}${tail}${rulesReq}`;
}
