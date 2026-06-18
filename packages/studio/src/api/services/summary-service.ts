import {
  SummaryStorage,
  createLLMClient,
  SummarizerAgent,
  type LLMClient,
  type ModelConfig,
  type ChapterSummary,
} from '@storyweaver/core';
import type { ChapterService } from './chapter-service.js';
import type { SSEEmitter } from '../sse.js';

/**
 * 章节摘要服务
 *
 * 章节发布时用正文（去标签）生成结构化摘要并存储，供前端展示与长篇记忆复用。
 */
export class SummaryService {
  private llmClient: LLMClient | null = null;
  private summarizerAgent: SummarizerAgent | null = null;

  constructor(
    private readonly chapterService: ChapterService,
    private readonly summaryStorage: SummaryStorage,
    private readonly sseEmitter: SSEEmitter,
    private readonly projectRoot: string,
  ) {}

  /** 为章节生成摘要（用正文）并存储；返回摘要，失败抛错（调用方决定如何处理） */
  async summarizeChapter(volume: number, chapterId: number): Promise<ChapterSummary> {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY 未配置，无法生成摘要');
    const chapter = await this.chapterService.read(volume, chapterId);
    if (!chapter) throw new Error('章节不存在');
    const text = chapter.content.replace(/<[^>]*>/g, '').trim();
    if (!text) throw new Error('章节内容为空，无法生成摘要');
    const summary = await this.getAgent().summarizeChapter(
      [{ role: 'user', content: text }],
      { chapter: chapterId, volume, title: chapter.title, wordCount: text.length },
    );
    await this.summaryStorage.saveChapterSummary(this.projectRoot, summary);
    // 章节摘要变化后重建时间线 + 角色状态派生视图（失败不阻塞）
    await this.summaryStorage.rebuildTimelineAndCharacterStates(this.projectRoot).catch(() => {});
    this.sseEmitter.emit({ type: 'summary:complete', data: { chapter: chapterId } });
    return summary;
  }

  /** 读取章节摘要 */
  async getChapterSummary(chapterId: number): Promise<ChapterSummary | null> {
    return this.summaryStorage.getChapterSummary(this.projectRoot, chapterId);
  }

  /** 删除章节摘要（章节回退草稿时调用，摘要只在 published 时生成） */
  async deleteChapterSummary(chapterId: number): Promise<boolean> {
    const deleted = await this.summaryStorage.deleteChapterSummary(this.projectRoot, chapterId);
    if (deleted) {
      // 回退草稿删除摘要后，重建派生视图以移除该章事件（失败不阻塞）
      await this.summaryStorage.rebuildTimelineAndCharacterStates(this.projectRoot).catch(() => {});
    }
    return deleted;
  }

  /** 读取时间线（供 /memory 页面与长篇记忆 Layer3 使用） */
  async getTimeline() {
    return this.summaryStorage.getTimeline(this.projectRoot);
  }

  /** 读取角色状态变迁 */
  async getCharacterStates() {
    return this.summaryStorage.getCharacterStates(this.projectRoot);
  }

  /** 正在生成摘要的章节集合（后端内存持久化，跨请求/组件保持，刷新页面不丢） */
  private generating = new Set<number>();

  isGenerating(chapterId: number): boolean {
    return this.generating.has(chapterId);
  }

  /** 异步启动摘要生成（不阻塞响应；状态记在 generating 集合，前端轮询 GET 查询进度） */
  startGenerate(volume: number, chapterId: number): void {
    if (this.generating.has(chapterId)) return; // 避免重复触发
    this.generating.add(chapterId);
    this.summarizeChapter(volume, chapterId)
      .catch((err) => console.error('[summary] 生成失败:', err instanceof Error ? err.message : err))
      .finally(() => this.generating.delete(chapterId));
  }

  /** 列出所有已发布章节及其摘要（无摘要的 summary=null，便于前端显示"生成/重新生成"） */
  async listSummaries(): Promise<Array<{ chapter: number; title: string; summary: ChapterSummary | null; generating: boolean }>> {
    const all = await this.chapterService.list();
    const published = all.filter((c) => c.status === 'published');
    const summaries = await this.summaryStorage.listChapterSummaries(this.projectRoot);
    const map = new Map(summaries.map((s) => [s.chapter, s]));
    return published
      .sort((a, b) => a.id - b.id)
      .map((c) => ({
        chapter: c.id,
        title: c.title,
        summary: map.get(c.id) ?? null,
        generating: this.generating.has(c.id),
      }));
  }

  private getAgent(): SummarizerAgent {
    if (this.summarizerAgent) return this.summarizerAgent;
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
    this.summarizerAgent = new SummarizerAgent(this.llmClient, { model, temperature: 0.3 });
    return this.summarizerAgent;
  }
}
