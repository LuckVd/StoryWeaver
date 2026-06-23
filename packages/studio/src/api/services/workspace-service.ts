import {
  WorkspaceStorage,
  SummaryStorage,
  createLLMClient,
  SummarizerAgent,
  type Workspace,
  type ChapterSummary,
  type LLMClient,
  type ModelConfig,
  type ChapterMeta,
  type Chapter,
} from '@storyweaver/core';
import type { SSEEmitter } from '../sse.js';
import type { ChapterService } from './chapter-service.js';

/** 发布结果 */
export interface PublishResult {
  /** 成功发布的章节 ID */
  published: number[];
  /** 生成摘要的章节 ID（LLM 可用时） */
  summarized: number[];
  /** 跳过摘要的章节（无 LLM 或 skipSummary） */
  skipped: number[];
}

/**
 * 工作区业务逻辑层
 *
 * 管理工作区（添加/移除章节）和发布流程（状态锁定 + AI 摘要生成 + SSE 进度）。
 */
export class WorkspaceService {
  private llmClient: LLMClient | null = null;
  private summarizerAgent: SummarizerAgent | null = null;

  constructor(
    private readonly workspaceStorage: WorkspaceStorage,
    private readonly chapterService: ChapterService,
    private readonly summaryStorage: SummaryStorage,
    private readonly sseEmitter: SSEEmitter,
    private readonly projectRoot: string,
  ) {}

  // ── 工作区管理 ──

  /** 获取工作区（不存在则自动创建空工作区） */
  async getWorkspace(): Promise<Workspace> {
    let ws = await this.workspaceStorage.read();
    if (!ws) {
      const now = new Date().toISOString();
      ws = { chapterIds: [], createdAt: now, updatedAt: now };
      await this.workspaceStorage.write(ws);
    }
    return ws;
  }

  /** 添加章节到工作区 */
  async addChapter(chapterId: number): Promise<Workspace> {
    const ws = await this.getWorkspace();
    if (ws.chapterIds.includes(chapterId)) {
      throw new Error('CHAPTER_ALREADY_IN_WORKSPACE');
    }
    ws.chapterIds.push(chapterId);
    ws.updatedAt = new Date().toISOString();
    await this.workspaceStorage.write(ws);
    return ws;
  }

  /** 从工作区移除章节 */
  async removeChapter(chapterId: number): Promise<Workspace> {
    const ws = await this.getWorkspace();
    const idx = ws.chapterIds.indexOf(chapterId);
    if (idx === -1) {
      throw new Error('CHAPTER_NOT_IN_WORKSPACE');
    }
    ws.chapterIds.splice(idx, 1);
    ws.updatedAt = new Date().toISOString();
    await this.workspaceStorage.write(ws);
    return ws;
  }

  /** 获取工作区内章节的完整信息（含状态） */
  async listChapters(): Promise<Array<ChapterMeta & { volume: number }>> {
    const ws = await this.getWorkspace();
    const result: Array<ChapterMeta & { volume: number }> = [];
    for (const id of ws.chapterIds) {
      const vol = await this.chapterService.findVolume(id);
      if (vol === null) continue;
      const chapter = await this.chapterService.read(vol, id);
      if (chapter) {
        const { volume, ...meta } = chapter;
        result.push({ ...meta, volume });
      }
    }
    return result;
  }

  // ── 发布流程 ──

  /** 批量发布 approved 章节 */
  async publish(chapterIds: number[], skipSummary = false): Promise<PublishResult> {
    const result: PublishResult = { published: [], summarized: [], skipped: [] };
    const total = chapterIds.length;

    // 1. 校验所有章节在工作区内且为 approved
    const ws = await this.getWorkspace();
    for (const id of chapterIds) {
      if (!ws.chapterIds.includes(id)) {
        throw new Error(`CHAPTER_NOT_IN_WORKSPACE:${id}`);
      }
    }

    // 预加载章节信息
    const chapterInfos = new Map<number, { volume: number; meta: Chapter }>();
    for (const id of chapterIds) {
      const vol = await this.chapterService.findVolume(id);
      if (vol === null) throw new Error(`CHAPTER_NOT_FOUND:${id}`);
      const chapter = await this.chapterService.read(vol, id);
      if (!chapter) throw new Error(`CHAPTER_NOT_FOUND:${id}`);
      if (chapter.status !== 'approved') {
        throw new Error(`CHAPTER_NOT_APPROVED:${id}`);
      }
      chapterInfos.set(id, { volume: vol, meta: chapter });
    }

    // 2. 逐章发布（状态锁定）
    let i = 0;
    for (const id of chapterIds) {
      const info = chapterInfos.get(id)!;
      await this.chapterService.updateStatus(info.volume, id, 'published');
      result.published.push(id);
      i++;
      this.sseEmitter.emit({
        type: 'publish:progress',
        data: { step: 'publishing', current: i, total },
      });
    }

    // 3. AI 摘要生成（如果 LLM 可用且未跳过）
    if (!skipSummary) {
      const llmAvailable = !!process.env.OPENAI_API_KEY;
      if (llmAvailable) {
        await this.generateSummaries(chapterIds, chapterInfos, result);
      } else {
        result.skipped.push(...chapterIds);
      }
    } else {
      result.skipped.push(...chapterIds);
    }

    // 4. 从工作区移除已发布章节
    ws.chapterIds = ws.chapterIds.filter((id) => !chapterIds.includes(id));
    ws.updatedAt = new Date().toISOString();
    await this.workspaceStorage.write(ws);

    // 5. 广播完成
    this.sseEmitter.emit({
      type: 'publish:complete',
      data: { chapters: result.published },
    });

    return result;
  }

  /** 为发布的章节生成摘要并更新剧情状态 */
  private async generateSummaries(
    chapterIds: number[],
    chapterInfos: Map<number, { volume: number; meta: Chapter }>,
    result: PublishResult,
  ): Promise<void> {
    const agent = this.getSummarizerAgent();
    const total = chapterIds.length;
    let i = 0;

    for (const id of chapterIds) {
      const info = chapterInfos.get(id)!;
      try {
        // 用去标签正文生成摘要(与 SummaryService.summarizeChapter 一致),
        // 而非仅传标题 —— 否则 LLM 凭标题编造情节,污染派生记忆全链。
        const text = info.meta.content.replace(/<[^>]*>/g, '').trim();
        if (!text) {
          result.skipped.push(id);
        } else {
          const summary = await agent.summarizeChapter(
            [{ role: 'user', content: text }],
            {
              chapter: id,
              volume: info.volume,
              title: info.meta.title,
              wordCount: text.length,
            },
          );
          await this.summaryStorage.saveChapterSummary(this.projectRoot, summary);
          result.summarized.push(id);
        }
      } catch {
        // 摘要生成失败不阻塞发布流程
        result.skipped.push(id);
      }
      i++;
      this.sseEmitter.emit({
        type: 'publish:progress',
        data: { step: 'summarizing', current: i, total },
      });
    }

    // 更新全局剧情状态
    try {
      const prevState = await this.summaryStorage.getStoryState(this.projectRoot);
      const newState = await agent.updateStoryState(
        [{ role: 'user', content: `已发布章节: ${chapterIds.join(', ')}` }],
        prevState,
      );
      newState.lastPublishedChapter = Math.max(...chapterIds);
      await this.summaryStorage.saveStoryState(this.projectRoot, newState);
    } catch {
      // 状态更新失败不阻塞
    }

    // 重建时间线 + 角色状态变迁（派生记忆，失败不阻塞）
    await this.summaryStorage.rebuildCharacterStates(this.projectRoot).catch(() => {});

    // 多章综合总结（每 BATCH_INTERVAL 章触发，G03-S03，失败不阻塞）
    await this.maybeGenerateBatchSummary(chapterIds).catch(() => {});
  }

  /**
   * 多章综合总结（G03-S03）：按固定间隔（默认 10 章）补齐所有尚未生成的区间。
   * 遍历 ≤ 当前最大章节号的每个间隔倍数端点，仅对缺失的 batch 生成，避免跳发时漏掉早期区间。
   * TODO: interval 从 novel.yaml.batchSummaryInterval 读取（待接入 config service）。
   */
  private async maybeGenerateBatchSummary(chapterIds: number[]): Promise<void> {
    const interval = 10;
    const maxCh = Math.max(...chapterIds);
    if (maxCh < interval) return;
    const summaries = await this.summaryStorage.listChapterSummaries(this.projectRoot);
    const existing = await this.summaryStorage.listBatchSummaries(this.projectRoot);
    const existingEnds = new Set(existing.map((b) => b.chapterRange[1]));
    for (let end = interval; end <= maxCh; end += interval) {
      if (existingEnds.has(end)) continue;
      const from = end - interval + 1;
      const inRange = summaries.filter((s) => s.chapter >= from && s.chapter <= end);
      if (inRange.length < 2) continue;
      const content = inRange
        .map((s) => `第${s.chapter}章 ${s.title}：${s.plotEvents.join('；')}（${s.plotOutcome}）`)
        .join('\n');
      try {
        const batch = await this.getSummarizerAgent().summarizeBatch(
          [{ role: 'user', content }],
          [from, end],
          inRange[0].volume,
        );
        await this.summaryStorage.saveBatchSummary(this.projectRoot, batch);
      } catch {
        // 单个区间失败不影响其他区间
      }
    }
  }

  /** 懒初始化 LLM 客户端和 SummarizerAgent */
  private getSummarizerAgent(): SummarizerAgent {
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
