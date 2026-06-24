import {
  createLLMClient,
  AuditorAgent,
  WriterAgent,
  type LLMClient,
  type ModelConfig,
  type ReviewReport,
  type Message,
} from '@storyweaver/core';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ChapterService } from './chapter-service.js';
import type { ModelService } from './model-service.js';
import type { AIOperationQueue } from '../queue.js';
import { toPlainText } from '../../lib/md-utils.js';

/**
 * 审稿服务
 *
 * 用章节正文触发 AuditorAgent 审稿，生成结构化报告（评分 + 问题列表）并存盘，
 * 供前端「提交审阅」展示。不改变章节状态（审稿是"检查"，approved 是独立动作）。
 */
export class ReviewService {
  private auditorAgent: AuditorAgent | null = null;
  private auditorModelId = '';
  private writerAgent: WriterAgent | null = null;
  private writerModelId = '';

  constructor(
    private readonly chapterService: ChapterService,
    private readonly projectRoot: string,
    private readonly modelService?: ModelService,
    private readonly aiQueue?: AIOperationQueue,
  ) {}

  /** AI 操作入队（保证全局同一时间仅一个 AI 操作，C3） */
  private runQueued<T>(fn: () => Promise<T>): Promise<T> {
    return this.aiQueue ? this.aiQueue.enqueue(fn) : fn();
  }

  /** 解析某 Agent 的 LLM client + 模型 id（assignment 优先，回退 env） */
  private async resolveClient(agentName: string): Promise<{ client: LLMClient; modelId: string }> {
    const resolved = this.modelService ? await this.modelService.resolveModelForAgent(agentName) : null;
    if (resolved) return { client: createLLMClient(resolved), modelId: resolved.id };
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY 未配置，无法调用 AI');
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
    const baseUrl = process.env.OPENAI_BASE_URL;
    const config: ModelConfig = { id: model, name: model, service: 'openai', apiKey, ...(baseUrl ? { baseUrl } : {}) };
    return { client: createLLMClient(config), modelId: model };
  }

  /** 审稿：读章节正文 → auditor 审 → 存报告 → 返回报告 */
  async reviewChapter(volume: number, chapterId: number): Promise<ReviewReport> {
    return this.runQueued(async () => {
      const chapter = await this.chapterService.read(volume, chapterId);
      if (!chapter) throw new Error('章节不存在');
      const text = toPlainText(chapter.content);
      if (!text) throw new Error('章节内容为空，无法审稿');
      const report = await (await this.getAuditorAgent()).audit(
        [{ role: 'user', content: text }] as Message[],
        chapterId,
      );
      await this.saveReport(report);
      return report;
    });
  }

  /** 根据审稿意见用 writer 修订正文，返回 { 原文, 修订 }（不改章节） */
  async reviseChapter(
    volume: number,
    chapterId: number,
    issues: unknown[],
  ): Promise<{ original: string; revised: string }> {
    return this.runQueued(async () => {
      const chapter = await this.chapterService.read(volume, chapterId);
      if (!chapter) throw new Error('章节不存在');
      const issuesText = (issues as Array<{ severity?: string; description?: string; message?: string }>)
        .map((i, idx) => `${idx + 1}. [${i.severity ?? ''}] ${i.description ?? i.message ?? ''}`)
        .join('\n');
      const text = toPlainText(chapter.content);
      const revised = await (await this.getWriterAgent()).write([
        {
          role: 'system',
          content:
            '你是小说修订助手。严格根据审稿意见修订正文，直接输出修订后的完整正文（Markdown 格式，段落用空行分隔），不要输出标题、解释或审稿意见。',
        },
        {
          role: 'user',
          content: `【审稿意见】\n${issuesText}\n\n【原文】\n${text}\n\n请根据审稿意见修订，输出完整修订正文（Markdown，段落用空行分隔）。`,
        },
      ]);
      return { original: chapter.content, revised };
    });
  }

  private async saveReport(report: ReviewReport): Promise<void> {
    const dir = resolve(this.projectRoot, 'reviews');
    await mkdir(dir, { recursive: true });
    const filePath = resolve(
      dir,
      `ch${String(report.chapterId).padStart(3, '0')}-review-${report.id.slice(0, 8)}.json`,
    );
    await writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  }

  private async getAuditorAgent(): Promise<AuditorAgent> {
    const { client, modelId } = await this.resolveClient('auditor');
    if (this.auditorAgent && this.auditorModelId === modelId) return this.auditorAgent;
    this.auditorAgent = new AuditorAgent(client, { model: modelId, temperature: 0.3 });
    this.auditorModelId = modelId;
    return this.auditorAgent;
  }

  private async getWriterAgent(): Promise<WriterAgent> {
    const { client, modelId } = await this.resolveClient('writer');
    if (this.writerAgent && this.writerModelId === modelId) return this.writerAgent;
    this.writerAgent = new WriterAgent(client, { model: modelId, temperature: 0.5 });
    this.writerModelId = modelId;
    return this.writerAgent;
  }
}
