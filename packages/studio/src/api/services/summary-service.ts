import {
  SummaryStorage,
  createLLMClient,
  SummarizerAgent,
  CuratorAgent,
  aggregateHooksTracking,
  type LLMClient,
  type ModelConfig,
  type ChapterSummary,
  type CurationSuggestion,
  type CurationSuggestions,
  type HookTracking,
  type ActionLogEntry,
  type WorldSubCategory,
} from '@storyweaver/core';
import type { ChapterService } from './chapter-service.js';
import type { KnowledgeService } from './knowledge-service.js';
import type { ModelService } from './model-service.js';
import type { SSEEmitter } from '../sse.js';

/**
 * 章节摘要服务
 *
 * 章节发布时用正文（去标签）生成结构化摘要并存储，供前端展示与长篇记忆复用。
 */
export class SummaryService {
  private summarizerAgent: SummarizerAgent | null = null;
  private summarizerModelId = '';
  private curatorAgent: CuratorAgent | null = null;
  private curatorModelId = '';
  private curating = new Set<number>();

  constructor(
    private readonly chapterService: ChapterService,
    private readonly summaryStorage: SummaryStorage,
    private readonly sseEmitter: SSEEmitter,
    private readonly projectRoot: string,
    private readonly knowledgeService: KnowledgeService,
    private readonly modelService?: ModelService,
  ) {}

  /** 解析某 Agent 的 LLM client + 模型 id(assignment 优先,回退 env) */
  private async resolveClient(agentName: string): Promise<{ client: LLMClient; modelId: string }> {
    const resolved = this.modelService ? await this.modelService.resolveModelForAgent(agentName) : null;
    if (resolved) return { client: createLLMClient(resolved), modelId: resolved.id };
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY 未配置,无法调用 AI');
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
    const baseUrl = process.env.OPENAI_BASE_URL;
    const config: ModelConfig = { id: model, name: model, service: 'openai', apiKey, ...(baseUrl ? { baseUrl } : {}) };
    return { client: createLLMClient(config), modelId: model };
  }

  /** 为章节生成摘要（用正文）并存储；返回摘要，失败抛错（调用方决定如何处理） */
  async summarizeChapter(volume: number, chapterId: number): Promise<ChapterSummary> {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY 未配置，无法生成摘要');
    const chapter = await this.chapterService.read(volume, chapterId);
    if (!chapter) throw new Error('章节不存在');
    const text = chapter.content.replace(/<[^>]*>/g, '').trim();
    if (!text) throw new Error('章节内容为空，无法生成摘要');
    const summary = await (await this.getAgent()).summarizeChapter(
      [{ role: 'user', content: text }],
      { chapter: chapterId, volume, title: chapter.title, wordCount: text.length },
    );
    await this.summaryStorage.saveChapterSummary(this.projectRoot, summary);
    // 章节摘要变化后重建时间线 + 角色状态派生视图（失败不阻塞）
    await this.summaryStorage.rebuildCharacterStates(this.projectRoot).catch(() => {});
    this.sseEmitter.emit({ type: 'summary:complete', data: { chapter: chapterId } });
    // 提取知识库实体建议（Curator，异步、失败不阻塞，结果待人工确认）
    this.startCurate(volume, chapterId);
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
      await this.summaryStorage.rebuildCharacterStates(this.projectRoot).catch(() => {});
    }
    return deleted;
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

  private async getAgent(): Promise<SummarizerAgent> {
    const { client, modelId } = await this.resolveClient('summarizer');
    if (this.summarizerAgent && this.summarizerModelId === modelId) return this.summarizerAgent;
    this.summarizerAgent = new SummarizerAgent(client, { model: modelId, temperature: 0.3 });
    this.summarizerModelId = modelId;
    return this.summarizerAgent;
  }

  /** 异步提取知识库实体建议（Curator Agent），不阻塞调用方 */
  startCurate(volume: number, chapterId: number): void {
    if (this.curating.has(chapterId)) return;
    if (!process.env.OPENAI_API_KEY) return;
    this.curating.add(chapterId);
    this.curateChapter(volume, chapterId)
      .catch((err) => console.error('[curation] 提取失败:', err instanceof Error ? err.message : err))
      .finally(() => this.curating.delete(chapterId));
  }

  isCurating(chapterId: number): boolean {
    return this.curating.has(chapterId);
  }

  /** 用章节正文调 Curator 提取实体建议，合并存储（同章节覆盖） */
  async curateChapter(volume: number, chapterId: number): Promise<CurationSuggestion | null> {
    if (!process.env.OPENAI_API_KEY) return null;
    const chapter = await this.chapterService.read(volume, chapterId);
    if (!chapter) return null;
    const text = chapter.content.replace(/<[^>]*>/g, '').trim();
    if (!text) return null;
    const suggested = await (await this.getCuratorAgent()).suggestEntities([{ role: 'user', content: text }]);
    const suggestion: CurationSuggestion = {
      chapter: chapterId,
      createdAt: new Date().toISOString(),
      characters: suggested.characters,
      hooks: suggested.hooks,
      worldEntries: suggested.worldEntries,
    };
    const existing = (await this.summaryStorage.getCurationSuggestions(this.projectRoot)) ?? {
      suggestions: [],
      updatedAt: suggestion.createdAt,
    };
    const others = existing.suggestions.filter((s) => s.chapter !== chapterId);
    const updated: CurationSuggestions = {
      suggestions: [...others, suggestion].sort((a, b) => a.chapter - b.chapter),
      updatedAt: suggestion.createdAt,
    };
    await this.summaryStorage.saveCurationSuggestions(this.projectRoot, updated);
    this.sseEmitter.emit({ type: 'curation:complete', data: { chapter: chapterId } });
    return suggestion;
  }

  /** 读取全部实体建议（供前端展示、人工确认） */
  async getCurationSuggestions() {
    return this.summaryStorage.getCurationSuggestions(this.projectRoot);
  }

  /** 手动重建角色状态派生记忆（基于全部章节摘要重新聚合） */
  async rebuildCharacterStates() {
    return this.summaryStorage.rebuildCharacterStates(this.projectRoot);
  }

  /** 伏笔追踪：Hook 实体 + 章节摘要聚合（确定性，不调 LLM，不受回忆/穿越影响） */
  async getHooksTracking(): Promise<HookTracking[]> {
    const [hooks, summaries] = await Promise.all([
      this.knowledgeService.listHooks().catch(() => []),
      this.summaryStorage.listChapterSummaries(this.projectRoot),
    ]);
    const currentChapter = summaries.length ? Math.max(...summaries.map((s) => s.chapter)) : 0;
    return aggregateHooksTracking(hooks, summaries, currentChapter);
  }

  /** 移除某条 curation 建议（确认入库或忽略后调用） */
  async removeCurationEntity(
    chapter: number,
    type: 'characters' | 'hooks' | 'worldEntries',
    name: string,
  ) {
    return this.summaryStorage.removeCurationEntity(this.projectRoot, chapter, type, name);
  }

  // ── 操作日志 + 状态变更（伏笔完成/激活、实体建议加入/放弃，均留痕） ──

  /** 读取操作日志 */
  async getActionLog() {
    return this.summaryStorage.getActionLog(this.projectRoot);
  }

  /** 伏笔状态变更：完成(resolve) / 重新激活(reactivate)，记录到操作日志 */
  async setHookAction(name: string, action: 'resolve' | 'reactivate'): Promise<void> {
    const hooks = await this.knowledgeService.listHooks();
    const hook = hooks.find((h) => h.name === name);
    if (!hook) throw new Error('伏笔不存在：' + name);
    const currentChapter = await this.getCurrentChapter();
    if (action === 'resolve') {
      await this.knowledgeService.updateHook(hook.id, { status: 'resolved', resolvedAt: currentChapter });
    } else {
      await this.knowledgeService.updateHook(hook.id, { status: 'active' });
    }
    await this.appendAction({
      action: action === 'resolve' ? 'hook_resolve' : 'hook_reactivate',
      target: name,
      chapter: currentChapter,
    });
  }

  /** 确认实体建议：写入知识库 + 移除建议 + 记录 */
  async acceptCuration(
    chapter: number,
    type: 'characters' | 'hooks' | 'worldEntries',
    name: string,
  ): Promise<void> {
    const suggestions = await this.summaryStorage.getCurationSuggestions(this.projectRoot);
    const s = suggestions?.suggestions.find((x) => x.chapter === chapter);
    const entity = s?.[type].find((e: { name: string }) => e.name === name);
    if (!s || !entity) throw new Error('建议不存在');
    if (type === 'characters') {
      const c = entity as { name: string; description: string };
      await this.knowledgeService.createCharacter({ name: c.name, description: c.description, firstAppearance: chapter });
    } else if (type === 'worldEntries') {
      const w = entity as { name: string; category: string; content: string };
      await this.knowledgeService.createWorld(w.category as WorldSubCategory, { category: w.category as WorldSubCategory, name: w.name, content: w.content });
    } else {
      const h = entity as { name: string; description: string };
      await this.knowledgeService.createHook({ name: h.name, description: h.description, status: 'active', plantedAt: chapter });
    }
    await this.summaryStorage.removeCurationEntity(this.projectRoot, chapter, type, name);
    await this.appendAction({ action: 'curation_accept', target: name, chapter, category: type });
  }

  /** 放弃实体建议：移除 + 记录（留痕可追溯） */
  async dismissCuration(
    chapter: number,
    type: 'characters' | 'hooks' | 'worldEntries',
    name: string,
  ): Promise<void> {
    await this.summaryStorage.removeCurationEntity(this.projectRoot, chapter, type, name);
    await this.appendAction({ action: 'curation_dismiss', target: name, chapter, category: type });
  }

  private async appendAction(entry: Omit<ActionLogEntry, 'at'>): Promise<void> {
    await this.summaryStorage.appendActionLog(this.projectRoot, entry).catch(() => {});
  }

  private async getCurrentChapter(): Promise<number> {
    const summaries = await this.summaryStorage.listChapterSummaries(this.projectRoot);
    return summaries.length ? Math.max(...summaries.map((s) => s.chapter)) : 0;
  }

  private async getCuratorAgent(): Promise<CuratorAgent> {
    const { client, modelId } = await this.resolveClient('curator');
    if (this.curatorAgent && this.curatorModelId === modelId) return this.curatorAgent;
    this.curatorAgent = new CuratorAgent(client, { model: modelId, temperature: 0.3 });
    this.curatorModelId = modelId;
    return this.curatorAgent;
  }
}
