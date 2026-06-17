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

/**
 * 审稿服务
 *
 * 用章节正文触发 AuditorAgent 审稿，生成结构化报告（评分 + 问题列表）并存盘，
 * 供前端「提交审阅」展示。不改变章节状态（审稿是"检查"，approved 是独立动作）。
 */
export class ReviewService {
  private llmClient: LLMClient | null = null;
  private auditorAgent: AuditorAgent | null = null;
  private writerAgent: WriterAgent | null = null;

  constructor(
    private readonly chapterService: ChapterService,
    private readonly projectRoot: string,
  ) {}

  /** 审稿：读章节正文 → auditor 审 → 存报告 → 返回报告 */
  async reviewChapter(volume: number, chapterId: number): Promise<ReviewReport> {
    const chapter = await this.chapterService.read(volume, chapterId);
    if (!chapter) throw new Error('章节不存在');
    const text = chapter.content.replace(/<[^>]*>/g, '').trim();
    if (!text) throw new Error('章节内容为空，无法审稿');
    const report = await this.getAgent().audit(
      [{ role: 'user', content: text }] as Message[],
      chapterId,
    );
    await this.saveReport(report);
    return report;
  }

  /** 根据审稿意见用 writer 修订正文，返回 { 原文, 修订 }（不改章节） */
  async reviseChapter(
    volume: number,
    chapterId: number,
    issues: unknown[],
  ): Promise<{ original: string; revised: string }> {
    const chapter = await this.chapterService.read(volume, chapterId);
    if (!chapter) throw new Error('章节不存在');
    const issuesText = (issues as Array<{ severity?: string; description?: string; message?: string }>)
      .map((i, idx) => `${idx + 1}. [${i.severity ?? ''}] ${i.description ?? i.message ?? ''}`)
      .join('\n');
    const text = chapter.content.replace(/<[^>]*>/g, '').trim();
    const revised = await this.getWriter().write([
      {
        role: 'system',
        content:
          '你是小说修订助手。严格根据审稿意见修订正文，直接输出修订后的完整正文（用 <p> 标签分段），不要输出标题、解释或审稿意见。',
      },
      {
        role: 'user',
        content: `【审稿意见】\n${issuesText}\n\n【原文】\n${text}\n\n请根据审稿意见修订，输出完整修订正文（HTML <p> 段落）。`,
      },
    ]);
    return { original: chapter.content, revised };
  }

  private getWriter(): WriterAgent {
    if (this.writerAgent) return this.writerAgent;
    const apiKey = process.env.OPENAI_API_KEY!;
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
    const baseUrl = process.env.OPENAI_BASE_URL;
    const config: ModelConfig = {
      id: model,
      name: model,
      service: 'openai',
      apiKey,
      ...(baseUrl ? { baseUrl } : {}),
    };
    this.llmClient = createLLMClient(config);
    this.writerAgent = new WriterAgent(this.llmClient, { model, temperature: 0.5 });
    return this.writerAgent;
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

  private getAgent(): AuditorAgent {
    if (this.auditorAgent) return this.auditorAgent;
    const apiKey = process.env.OPENAI_API_KEY!;
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
    const baseUrl = process.env.OPENAI_BASE_URL;
    const config: ModelConfig = {
      id: model,
      name: model,
      service: 'openai',
      apiKey,
      ...(baseUrl ? { baseUrl } : {}),
    };
    this.llmClient = createLLMClient(config);
    this.auditorAgent = new AuditorAgent(this.llmClient, { model, temperature: 0.3 });
    return this.auditorAgent;
  }
}
