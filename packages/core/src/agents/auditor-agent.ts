import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { LLMClient, ChatOptions } from '../llm/types.js';
import type { Message, AgentConfig } from '../models/index.js';
import type { ReviewDimension, IssueSeverity, ReviewReport } from '../models/review.js';
import { BaseAgent } from './base-agent.js';
import { loadPrompt } from './prompts.js';

// ── Zod Schemas ──

const reviewDimensionSchema = z.enum([
  'character_consistency',
  'timeline',
  'worldview',
  'hooks',
  'pacing',
  'style',
  'length',
]);

const issueSeveritySchema = z.enum(['high', 'medium', 'low']);

/** 审稿报告 JSON 输出 schema（不含 id/chapterId/createdAt，由代码填充） */
const reviewReportDataSchema = z.object({
  overallScore: z.number().min(0).max(10),
  scores: z.array(
    z.object({
      dimension: reviewDimensionSchema,
      score: z.number().min(0).max(10),
      weight: z.number(),
      comment: z.string().optional(),
    }),
  ),
  issues: z.array(
    z.object({
      dimension: reviewDimensionSchema,
      severity: issueSeveritySchema,
      location: z.string(),
      description: z.string(),
      suggestion: z.string().optional(),
    }),
  ),
  summary: z.string(),
});

// ── 默认审稿维度 + 权重 ──

const DEFAULT_DIMENSIONS: Array<{ dimension: ReviewDimension; weight: number }> = [
  { dimension: 'character_consistency', weight: 0.20 },
  { dimension: 'timeline', weight: 0.15 },
  { dimension: 'worldview', weight: 0.15 },
  { dimension: 'hooks', weight: 0.10 },
  { dimension: 'pacing', weight: 0.15 },
  { dimension: 'style', weight: 0.15 },
  { dimension: 'length', weight: 0.10 },
];

// ── AuditorAgent ──

/**
 * Auditor Agent — 审稿 / 多维度审查
 *
 * 低温度（0.3），严格审查，输出结构化 ReviewReport。
 */
export class AuditorAgent extends BaseAgent {
  readonly name = 'auditor' as const;
  private systemPrompt: string;

  constructor(client: LLMClient, config: AgentConfig, configDir?: string) {
    super(client, { ...config, temperature: config.temperature ?? 0.3 });
    this.systemPrompt = config.systemPrompt ?? loadPrompt('auditor', configDir);
  }

  /** 流式审稿（输出自然语言审稿过程） */
  async *auditStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncGenerator<string> {
    yield* this.chatStream(
      [{ role: 'system', content: this.systemPrompt }, ...messages],
      options,
    );
  }

  /**
   * 结构化审稿
   *
   * 使用 chatStructured 获取 JSON 格式的 ReviewReport。
   * @param chapterId 关联的章节 ID
   */
  async audit(messages: Message[], chapterId: number): Promise<ReviewReport> {
    const auditMessages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...messages,
      {
        role: 'user',
        content: buildAuditPrompt(),
      },
    ];

    const data = await this.chatStructured(auditMessages, reviewReportDataSchema);

    return {
      id: randomUUID(),
      chapterId,
      overallScore: data.overallScore,
      scores: data.scores,
      issues: data.issues,
      summary: data.summary,
      createdAt: new Date().toISOString(),
    };
  }
}

/** 构建结构化审稿请求 prompt */
function buildAuditPrompt(): string {
  const dimensions = DEFAULT_DIMENSIONS.map(
    (d) => `  - ${d.dimension} (权重 ${d.weight})`,
  ).join('\n');

  return `请对以上内容进行结构化审稿，输出 JSON 格式的审稿报告。

审稿维度及权重：
${dimensions}

输出格式要求（严格 JSON）：
{
  "overallScore": <0-10 综合评分>,
  "scores": [
    { "dimension": "<维度名>", "score": <0-10>, "weight": <权重>, "comment": "<评语>" }
  ],
  "issues": [
    { "dimension": "<维度名>", "severity": "<high|medium|low>", "location": "<原文位置>", "description": "<问题描述>", "suggestion": "<修改建议>" }
  ],
  "summary": "<审稿总结>"
}

请确保：
1. scores 覆盖全部 7 个维度
2. overallScore 是加权计算的结果
3. issues 按严重程度从高到低排列
4. 只输出 JSON，不要输出其他内容`;
}
