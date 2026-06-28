import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createLLMClient,
  WriterAgent,
  BrainstormerAgent,
  AuditorAgent,
  routeUserMessage,
  buildInjection,
  getOutlineNeighbors,
  type LLMClient,
  type AgentName,
  type Message,
  type ChatSession,
  type ChatMessage,
  type ModelConfig,
  type ReviewReport,
  type Chapter,
  type ChapterSummary,
  type SummaryStorage,
  type InjectionChapter,
} from '@storyweaver/core';
import type { InMemorySearchEngine, ToolCall } from '@storyweaver/core';
import { AGENT_TOOLS, createToolExecutor } from './agent-tools.js';
import type { AIOperationQueue } from '../queue.js';
import type { SSEEmitter } from '../sse.js';
import type { ChapterService } from './chapter-service.js';
import type { KnowledgeService } from './knowledge-service.js';
import type { ModelService } from './model-service.js';

/** 支持 Agent 类型联合 */
type AnyAgent = WriterAgent | BrainstormerAgent | AuditorAgent;

/** 当前章正文尾部保留字数(接续点) */
const CHAPTER_TAIL_CHARS = 2000;

/** 对话历史占窗口的比例(滑动窗口配额) */
const DIALOG_WINDOW_RATIO = 0.15;

/**
 * 对话服务层
 *
 * 管理会话、执行 AI 对话（路由 → Agent → 流式输出）、应用内容到章节。
 * 上下文注入采用四档模型（恒定→当前→相关→填充），见 core/memory/injection-builder。
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
    private readonly searchEngine?: InMemorySearchEngine,
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
    const agentName: AgentName =
      context?.agentOverride ?? (await routeUserMessage(userContent, undefined, llmClient));

    // 入队执行
    this.aiQueue.enqueue(async () => {
      const agent = await this.getAgentForName(agentName);

      // 并行收集四档注入所需数据(各源失败均降级为空,不阻断对话)
      const chapterRef = context?.chapterRef ?? session.chapterId;
      const [outlineTree, rules, storyState, summaries, characterStates, hooks, batchSummaries, chapterData] =
        await Promise.all([
          this.knowledgeService.getOutline().catch(() => null),
          this.knowledgeService.listRules().catch(() => []),
          this.summaryStorage.getStoryState(this.projectRoot).catch(() => null),
          this.summaryStorage.listChapterSummaries(this.projectRoot).catch(() => []),
          this.summaryStorage.getCharacterStates(this.projectRoot).catch(() => null),
          this.knowledgeService.listHooks().catch(() => []),
          this.summaryStorage.listBatchSummaries(this.projectRoot).catch(() => []),
          this.loadChapterTail(chapterRef),
        ]);

      const outlineNeighbors = chapterRef
        ? getOutlineNeighbors(outlineTree, chapterRef, 1, 1)
        : { current: null, before: [], after: [] };
      const entities = extractRecentKeywords(summaries);
      const currentChapter = summaries.length
        ? Math.max(...summaries.map((s) => s.chapter))
        : chapterRef ?? 0;
      const dialogChars = session.messages.reduce((n, m) => n + m.content.length, 0);

      // 四档注入(恒定→当前→相关→填充,全局预算协调)
      const injection = buildInjection({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o',
        chapter: chapterData,
        outlineNeighbors,
        rules,
        storyState,
        searchEngine: this.searchEngine,
        entities,
        summaries,
        hooks,
        batchSummaries,
        characterStates,
        dialogChars,
        currentChapter,
      });

      // 组装 messages:四档 system(按优先级)+ 滑动窗口对话历史
      // (agent.writeStream 会自动在最前注入 Agent systemPrompt 人格)
      const messages: Message[] = [];
      if (injection.constant) messages.push({ role: 'system', content: injection.constant });
      if (injection.chapterContext) messages.push({ role: 'system', content: injection.chapterContext });
      if (injection.retrieved) messages.push({ role: 'system', content: injection.retrieved });
      if (injection.budgetFill) messages.push({ role: 'system', content: injection.budgetFill });
      messages.push(...slidingWindow(session.messages, Math.floor(injection.budget.total * DIALOG_WINDOW_RATIO)));

      // 广播开始
      this.sseEmitter.emit({ type: 'agent:start', data: { agent: agentName, stage: 'generating' } });

      // 有搜索引擎时,所有 agent 走原生 FC agentic(按需查阅资料换准确度);否则普通流式
      let stream: AsyncGenerator<string>;
      if (this.searchEngine) {
        const executor = createToolExecutor({
          searchEngine: this.searchEngine,
          knowledgeService: this.knowledgeService,
          summaryStorage: this.summaryStorage,
          projectRoot: this.projectRoot,
        });
        stream = getStreamWithTools(agent, messages, executor, agentName, this.sseEmitter);
      } else {
        stream = getStream(agent, messages);
      }

      let fullContent = '';
      try {
        for await (const token of stream) {
          fullContent += token;
          this.sseEmitter.emit({ type: 'agent:token', data: { agent: agentName, token } });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.sseEmitter.emit({ type: 'error', data: { message, recoverable: true } });
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
      this.sseEmitter.emit({ type: 'agent:complete', data: { agent: agentName, result: null, messageId: assistantMsg.id } });

      // Auditor: 额外生成结构化审稿报告
      if (agentName === 'auditor') {
        try {
          const chapterId = session.chapterId ?? context?.chapterRef ?? 0;
          const report = await (agent as AuditorAgent).audit(messages, chapterId);
          await this.saveReviewReport(report);
          this.sseEmitter.emit({ type: 'review:score', data: { score: report.overallScore, issues: report.issues } });
        } catch {
          // 审稿报告生成失败不影响对话流程
        }
      }
    });
  }

  /** 加载当前章正文尾部(去 HTML,取接续点) */
  private async loadChapterTail(chapterRef: number | null): Promise<InjectionChapter | null> {
    if (!chapterRef) return null;
    const volume = await this.chapterService.findVolume(chapterRef);
    if (volume === null) return null;
    const chapter = await this.chapterService.read(volume, chapterRef);
    if (!chapter) return null;
    const textContent = chapter.content.replace(/<[^>]*>/g, '').trim();
    if (!textContent) return null;
    return {
      id: chapterRef,
      title: chapter.title,
      contentTail: textContent.slice(-CHAPTER_TAIL_CHARS),
    };
  }

  // --- Apply ---

  /** 将 AI 纯文本转为 HTML（段落用 <p> 包裹） */
  private textToHtml(text: string): string {
    return text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
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
    const aiHtml = this.textToHtml(aiContent);
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
      updated = await this.chapterService.update(volume, target.chapterId, {
        content: chapter.content + aiHtml,
      }, 'ai_apply');
    } else {
      updated = await this.chapterService.update(volume, target.chapterId, {
        content: aiHtml,
      }, 'ai_apply');
    }
    return { content: updated?.content ?? aiHtml };
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
  return (agent as WriterAgent).writeStream(messages);
}

/** 获取 Agent 带工具的流式输出(原生 FC agentic,writer/auditor/brainstormer 通用) */
function getStreamWithTools(
  agent: AnyAgent,
  messages: Message[],
  executor: (call: ToolCall) => Promise<string>,
  agentName: AgentName,
  sseEmitter: SSEEmitter,
): AsyncGenerator<string> {
  const onToolCall = (n: string) =>
    sseEmitter.emit({ type: 'agent:thinking', data: { agent: agentName, stage: `查询 ${n}` } });
  const opts = { maxIterations: 5, onToolCall };
  const a = agent as unknown as Record<string, unknown>;
  if (a.name === 'writer') {
    return (agent as WriterAgent).writeStreamWithTools(messages, AGENT_TOOLS, executor, opts);
  }
  if (a.name === 'auditor') {
    return (agent as AuditorAgent).auditStreamWithTools(messages, AGENT_TOOLS, executor, opts);
  }
  return (agent as BrainstormerAgent).brainstormStreamWithTools(messages, AGENT_TOOLS, executor, opts);
}

/** 从最近几章摘要提取角色/地点关键词，供相关性检索召回 */
function extractRecentKeywords(summaries: ChapterSummary[]): string[] {
  const recent = [...summaries].sort((a, b) => b.chapter - a.chapter).slice(0, 3);
  const set = new Set<string>();
  for (const s of recent) {
    s.charactersPresent.forEach((c) => set.add(c));
    s.locationsUsed.forEach((l) => set.add(l));
  }
  return [...set].slice(0, 20);
}

/** 对话历史滑动窗口:从最新往回取,累计到 maxChars 为止(至少保留最新一条) */
function slidingWindow(messages: ChatMessage[], maxChars: number): Message[] {
  const picked: Message[] = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (picked.length > 0 && chars + m.content.length > maxChars) break;
    picked.unshift({ role: m.role, content: m.content });
    chars += m.content.length;
  }
  return picked;
}
