import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createLLMClient,
  WriterAgent,
  BrainstormerAgent,
  AuditorAgent,
  SummarizerAgent,
  CuratorAgent,
  routeUserMessage,
  buildMemoryContext,
  retrieveRemoteMemory,
  type LLMClient,
  type AgentName,
  type Message,
  type ChatSession,
  type ChatMessage,
  type ModelConfig,
  type AgentConfig,
  type ReviewReport,
  type Chapter,
  type ChapterSummary,
  type WorldSubCategory,
  type SummaryStorage,
} from '@storyweaver/core';
import type { AIOperationQueue } from '../queue.js';
import type { SSEEmitter } from '../sse.js';
import type { ChapterService } from './chapter-service.js';
import type { KnowledgeService } from './knowledge-service.js';
import type { ModelService } from './model-service.js';

/** 支持 Agent 类型联合 */
type AnyAgent = WriterAgent | BrainstormerAgent | AuditorAgent | SummarizerAgent | CuratorAgent;

/**
 * 对话服务层
 *
 * 管理会话、执行 AI 对话（路由 → Agent → 流式输出）、应用内容到章节。
 */
export class ChatService {
  private sessions = new Map<string, ChatSession>();
  private llmClient: LLMClient | null = null;
  private agents: Partial<Record<AgentName, { agent: AnyAgent; modelId: string }>> = {};

  constructor(
    private readonly aiQueue: AIOperationQueue,
    private readonly sseEmitter: SSEEmitter,
    private readonly chapterService: ChapterService,
    private readonly knowledgeService: KnowledgeService,
    private readonly summaryStorage: SummaryStorage,
    private readonly projectRoot: string,
    private readonly modelService?: ModelService,
  ) {}

  // --- Session CRUD ---

  createSession(input?: { chapterId?: number; title?: string }): ChatSession {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: randomUUID(),
      chapterId: input?.chapterId ?? null,
      title: input?.title ?? '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): ChatSession | null {
    return this.sessions.get(id) ?? null;
  }

  listSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  // --- 对话 ---

  /** 发送消息并触发 AI 流式回复 */
  async handleMessage(
    sessionId: string,
    userContent: string,
    context?: { chapterRef?: number; agentOverride?: AgentName },
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    // 追加用户消息
    const userMsg: ChatMessage = {
      id: randomUUID(),
      role: 'user',
      content: userContent,
      createdAt: new Date().toISOString(),
    };
    session.messages.push(userMsg);
    session.updatedAt = new Date().toISOString();

    // 确定 Agent
    const llmClient = this.llmClient ?? undefined;
    const agentName: AgentName = context?.agentOverride ?? await routeUserMessage(userContent, undefined, llmClient);

    // 入队执行
    this.aiQueue.enqueue(async () => {
      const agent = await this.getAgentForName(agentName);
      const messages: Message[] = [];

      // 如果绑定了章节，加载章节内容作为上下文
      const chapterRef = context?.chapterRef ?? session.chapterId;
      if (chapterRef) {
        const volume = await this.chapterService.findVolume(chapterRef);
        if (volume !== null) {
          const chapter = await this.chapterService.read(volume, chapterRef);
          if (chapter) {
            const textContent = chapter.content.replace(/<[^>]*>/g, '').trim();
            if (textContent) {
              messages.push({
                role: 'system',
                content: `以下是当前章节「${chapter.title}」的已有内容（共${textContent.length}字）：\n\n${textContent}`,
              });
            }
          }
        }
      }

      // 追加聊天历史（>10 轮时压缩早期对话为摘要，仅注入最近 5 轮完整，C4）
      await this.appendHistory(messages, session);

      // 注入长篇记忆（三层）：仅写作/审稿 Agent，让 AI 感知前文剧情与角色状态
      if (agentName === 'writer' || agentName === 'auditor') {
        try {
          const memoryContext = await this.buildMemoryContext();
          if (memoryContext) {
            messages.unshift({ role: 'system', content: memoryContext });
          }
        } catch {
          // 记忆加载失败不阻断对话
        }
      }

      // 注入知识库设定（全量），放在最前，确保 AI 遵守已有设定
      try {
        const kbContext = await this.buildKnowledgeContext();
        if (kbContext) {
          messages.unshift({ role: 'system', content: kbContext });
        }
      } catch {
        // 知识库加载失败不阻断对话
      }

      // 广播开始
      this.sseEmitter.emit({ type: 'agent:start', data: { agent: agentName, stage: 'generating', sessionId } });

      let fullContent = '';
      try {
        const stream = getStream(agent, messages);
        for await (const token of stream) {
          fullContent += token;
          this.sseEmitter.emit({ type: 'agent:token', data: { agent: agentName, token, sessionId } });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.sseEmitter.emit({ type: 'error', data: { message, recoverable: true, sessionId } });
        return;
      }

      // 追加 AI 消息
      const assistantMsg: ChatMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: fullContent,
        createdAt: new Date().toISOString(),
        agent: agentName,
      };
      session.messages.push(assistantMsg);
      session.updatedAt = new Date().toISOString();

      // 广播完成
      this.sseEmitter.emit({ type: 'agent:complete', data: { agent: agentName, result: null, messageId: assistantMsg.id, sessionId } });

      // Auditor: 额外生成结构化审稿报告
      if (agentName === 'auditor') {
        try {
          const chapterId = session.chapterId ?? context?.chapterRef ?? 0;
          const report = await (agent as AuditorAgent).audit(messages, chapterId);
          await this.saveReviewReport(report);
          this.sseEmitter.emit({ type: 'review:score', data: { score: report.overallScore, issues: report.issues, sessionId } });
        } catch {
          // 审稿报告生成失败不影响对话流程
        }
      }
    });
  }

  // --- Apply ---

  /** 将 AI 纯文本转为 Markdown（段落用空行分隔，与章节存储格式一致） */
  private textToMd(text: string): string {
    return text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .join('\n\n');
  }

  /** 剥离 AI 误加的 Markdown 标题行（# / ## 等），避免污染正文 */
  private stripTitleLines(text: string): string {
    return text
      .split('\n')
      .filter((line) => !/^#{1,6}\s/.test(line.trim()))
      .join('\n')
      .trim();
  }

  /** 将 AI 回复应用到章节 */
  async applyMessage(
    sessionId: string,
    messageId: string,
    target: { chapterId: number; mode: 'append' | 'replace'; content?: string },
  ): Promise<{ content: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const message = session.messages.find((m) => m.id === messageId);
    if (!message || message.role !== 'assistant') {
      throw new Error('MESSAGE_NOT_FOUND');
    }

    const aiContent = this.stripTitleLines(target.content ?? message.content);
    const aiMd = this.textToMd(aiContent);
    const volume = await this.chapterService.findVolume(target.chapterId);
    if (volume === null) {
      throw new Error('CHAPTER_NOT_FOUND');
    }

    let updated: Chapter | null;
    if (target.mode === 'append') {
      const chapter = await this.chapterService.read(volume, target.chapterId);
      if (!chapter) {
        throw new Error('CHAPTER_NOT_FOUND');
      }
      const sep = chapter.content && !chapter.content.endsWith('\n') ? '\n\n' : '';
      updated = await this.chapterService.update(volume, target.chapterId, {
        content: chapter.content + sep + aiMd,
      }, 'ai_apply');
    } else {
      updated = await this.chapterService.update(volume, target.chapterId, {
        content: aiMd,
      }, 'ai_apply');
    }
    return { content: updated?.content ?? aiMd };
  }

  // --- 知识库上下文 ---

  /**
   * 构建知识库上下文（全量），作为 system 设定注入对话。
   * 让写作/审稿 Agent 能感知角色、世界观、规则、伏笔等已有设定，避免自由发挥。
   */
  private async buildKnowledgeContext(maxChars = 8000): Promise<string> {
    const ks = this.knowledgeService;
    const worldSubs: WorldSubCategory[] = ['geography', 'power-system', 'factions', 'history', 'glossary'];

    const [characters, items, hooks, rules, customCats, ...worldBySub] = await Promise.all([
      ks.listCharacters(),
      ks.listItems(),
      ks.listHooks(),
      ks.listRules(),
      ks.listCustomCategories(),
      ...worldSubs.map((s) => ks.listWorld(s)),
    ]);
    const worldEntries = worldBySub.flat();
    const customs = await Promise.all(customCats.map((c) => ks.listCustom(c)));
    const customEntries = customs.flat();

    const lines: string[] = ['## 知识库设定（写作时必须严格遵守，不得违背已有设定）'];

    if (characters.length) {
      lines.push('### 角色');
      for (const c of characters) {
        const parts: string[] = [c.description];
        if (c.aliases?.length) parts.push(`别名：${c.aliases.join('、')}`);
        if (c.profile) parts.push(`档案：${c.profile}`);
        if (c.firstAppearance) parts.push(`首次出场：第${c.firstAppearance}章`);
        lines.push(`- **${c.name}**：${parts.join('；')}`);
      }
    }
    if (worldEntries.length) {
      lines.push('### 世界观');
      for (const w of worldEntries) {
        lines.push(`- **${w.name}**：${w.content}`);
      }
    }
    if (items.length) {
      lines.push('### 物品');
      for (const it of items) {
        lines.push(`- **${it.name}**：${it.description}`);
      }
    }
    if (hooks.length) {
      lines.push('### 伏笔');
      for (const h of hooks) {
        const status = h.status === 'active' ? '进行中' : '已回收';
        lines.push(`- **${h.name}**（${status}）：${h.description}`);
      }
    }
    if (rules.length) {
      lines.push('### 规则（必须遵守）');
      const prioMap: Record<string, string> = { high: '高', medium: '中', low: '低' };
      for (const r of rules) {
        lines.push(`- [${prioMap[r.priority] ?? r.priority}] **${r.name}**：${r.content}`);
      }
    }
    if (customEntries.length) {
      lines.push('### 其他设定');
      for (const cu of customEntries) {
        lines.push(`- **${cu.name}**：${cu.content}`);
      }
    }

    if (lines.length === 1) return ''; // 仅标题，无实质内容
    const text = lines.join('\n');
    // 知识库随长篇累积会膨胀，设字符上限避免挤占正文/历史 token（与 G03 token 预算哲学一致）；
    // 顺序已按重要性（角色→世界观→物品→伏笔→规则→自定义）排列，截断保留靠前的重要设定。
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n…（知识库内容过长，已截断；重要设定在前）';
  }

  /**
   * 构建长篇记忆上下文（三层）：Layer1 故事状态快照 + Layer2 近期章节摘要 +
   * Layer3 character-states 兜底（+ 远期检索）。供写作/审稿 Agent 感知前文，保持长篇连贯。
   * 数据由发布流程自动维护；此处只读组装，失败不阻断对话。
   */
  private async buildMemoryContext(): Promise<string> {
    const [storyState, summaries, characterStates, hooks, batchSummaries, outline] = await Promise.all([
      this.summaryStorage.getStoryState(this.projectRoot),
      this.summaryStorage.listChapterSummaries(this.projectRoot),
      this.summaryStorage.getCharacterStates(this.projectRoot),
      this.knowledgeService.listHooks().catch(() => []),
      this.summaryStorage.listBatchSummaries(this.projectRoot),
      this.knowledgeService.getOutline().catch(() => null),
    ]);
    if (!storyState && summaries.length === 0 && !characterStates) {
      return ''; // 无任何记忆数据，跳过注入
    }
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
    // 远期检索（G03-S06）：用近期出现的角色/地点作关键词，召回相关章节、待回收伏笔与综合总结
    const keywords = extractRecentKeywords(summaries);
    const currentChapter = summaries.length ? Math.max(...summaries.map((s) => s.chapter)) : 0;
    const remoteRetrieved = retrieveRemoteMemory({
      keywords,
      summaries,
      hooks,
      outline: outline ? [outline] : [],
      batchSummaries,
      currentChapter,
    });
    const ctx = buildMemoryContext({
      model,
      storyState,
      recentSummaries: summaries,
      characterStates,
      remoteRetrieved, // 检索结果优先；无命中时 buildMemoryContext 自动回退 characterStates
    });
    const parts = [ctx.layer1, ctx.layer2, ctx.layer3].filter(Boolean);
    if (!parts.length) return '';
    return `## 长篇记忆（前文剧情与角色状态，写作/审稿时参考以保持连贯）\n\n${parts.join('\n\n')}`;
  }

  /**
   * 组装聊天历史注入 LLM。
   * 超过 10 轮（20 条）时，把早期对话压缩成摘要（incremental：仅压缩尚未处理的部分），
   * 仅保留最近 5 轮（10 条）完整，控制 token 开销、保持长对话连贯（C4）。
   * session.messages 全量保留（前端显示完整历史），dialogSummary 仅用于 LLM 上下文。
   */
  private async appendHistory(messages: Message[], session: ChatSession): Promise<void> {
    const SUMMARIZE_THRESHOLD = 20;
    const KEEP_RECENT = 10;
    const history = session.messages;
    if (history.length <= SUMMARIZE_THRESHOLD) {
      for (const m of history) messages.push({ role: m.role, content: m.content });
      return;
    }
    const compressedUpTo = session.dialogCompressedUpTo ?? 0;
    const olderSlice = history.slice(compressedUpTo, history.length - KEEP_RECENT);
    if (olderSlice.length > 0) {
      try {
        const summarizer = (await this.getAgentForName('summarizer')) as SummarizerAgent;
        const prev: Message[] = session.dialogSummary
          ? [{ role: 'user', content: `之前已压缩的早期对话摘要：\n${session.dialogSummary}` }]
          : [];
        const compressed = await summarizer.compressDialog([
          ...prev,
          ...olderSlice.map((m) => ({ role: m.role, content: m.content })),
        ]);
        session.dialogSummary = compressed;
        session.dialogCompressedUpTo = history.length - KEEP_RECENT;
      } catch {
        // 压缩失败不阻断对话，回退全量历史
        for (const m of history) messages.push({ role: m.role, content: m.content });
        return;
      }
    }
    if (session.dialogSummary) {
      messages.push({ role: 'system', content: `早期对话摘要：\n${session.dialogSummary}` });
    }
    for (const m of history.slice(-KEEP_RECENT)) {
      messages.push({ role: m.role, content: m.content });
    }
  }

  // --- LLM 初始化 ---

  private initLLM(): { client: LLMClient; model: string } {
    if (this.llmClient) {
      return { client: this.llmClient, model: process.env.OPENAI_MODEL ?? 'gpt-4o' };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY 未配置，请在 .env 文件中设置');
    }

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
    return { client: this.llmClient, model };
  }

  /** 根据 Agent 名称获取对应 Agent 实例(按 assignment 选模型,模型变更时重建) */
  private async getAgentForName(name: AgentName): Promise<AnyAgent> {
    const resolved = this.modelService ? await this.modelService.resolveModelForAgent(name) : null;
    const modelId = resolved?.id ?? (process.env.OPENAI_MODEL ?? 'gpt-4o');
    const cached = this.agents[name];
    if (cached && cached.modelId === modelId) return cached.agent;

    const client = resolved ? createLLMClient(resolved) : this.initLLM().client;
    let agent: AnyAgent;
    switch (name) {
      case 'brainstormer':
        agent = new BrainstormerAgent(client, { model: modelId, temperature: 1.0 });
        break;
      case 'auditor':
        agent = new AuditorAgent(client, { model: modelId, temperature: 0.3 });
        break;
      case 'summarizer':
        agent = new SummarizerAgent(client, { model: modelId, temperature: 0.3 });
        break;
      case 'curator':
        agent = new CuratorAgent(client, { model: modelId, temperature: 0.3 });
        break;
      default:
        agent = new WriterAgent(client, { model: modelId, temperature: 0.7 });
        break;
    }

    this.agents[name] = { agent, modelId };
    return agent;
  }

  /** 保存审稿报告到 reviews/ 目录 */
  private async saveReviewReport(report: ReviewReport): Promise<void> {
    const dir = resolve(process.cwd(), 'reviews');
    const filePath = resolve(dir, `ch${String(report.chapterId).padStart(3, '0')}-review-${report.id.slice(0, 8)}.json`);
    const { mkdir } = await import('node:fs/promises');
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  }
}

/** 获取 Agent 的流式输出 */
function getStream(agent: AnyAgent, messages: Message[]): AsyncGenerator<string> {
  const a = agent as unknown as Record<string, unknown>;
  if (a.name === 'brainstormer') {
    return (agent as BrainstormerAgent).brainstormStream(messages);
  }
  if (a.name === 'auditor') {
    return (agent as AuditorAgent).auditStream(messages);
  }
  if (a.name === 'summarizer') {
    return (agent as SummarizerAgent).summarizeStream(messages);
  }
  if (a.name === 'curator') {
    return (agent as CuratorAgent).curateStream(messages);
  }
  return (agent as WriterAgent).writeStream(messages);
}

/** 从最近几章摘要提取角色/地点关键词，供远期检索召回相关章节 */
function extractRecentKeywords(summaries: ChapterSummary[]): string[] {
  const recent = [...summaries].sort((a, b) => b.chapter - a.chapter).slice(0, 3);
  const set = new Set<string>();
  for (const s of recent) {
    s.charactersPresent.forEach((c) => set.add(c));
    s.locationsUsed.forEach((l) => set.add(l));
  }
  return [...set].slice(0, 20);
}
