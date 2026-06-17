import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createLLMClient,
  WriterAgent,
  BrainstormerAgent,
  AuditorAgent,
  routeUserMessage,
  type LLMClient,
  type AgentName,
  type Message,
  type ChatSession,
  type ChatMessage,
  type ModelConfig,
  type AgentConfig,
  type ReviewReport,
  type Chapter,
  type WorldSubCategory,
} from '@storyweaver/core';
import type { AIOperationQueue } from '../queue.js';
import type { SSEEmitter } from '../sse.js';
import type { ChapterService } from './chapter-service.js';
import type { KnowledgeService } from './knowledge-service.js';

/** 支持 Agent 类型联合 */
type AnyAgent = WriterAgent | BrainstormerAgent | AuditorAgent;

/**
 * 对话服务层
 *
 * 管理会话、执行 AI 对话（路由 → Agent → 流式输出）、应用内容到章节。
 */
export class ChatService {
  private sessions = new Map<string, ChatSession>();
  private llmClient: LLMClient | null = null;
  private agents: Partial<Record<AgentName, AnyAgent>> = {};

  constructor(
    private readonly aiQueue: AIOperationQueue,
    private readonly sseEmitter: SSEEmitter,
    private readonly chapterService: ChapterService,
    private readonly knowledgeService: KnowledgeService,
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
      const agent = this.getAgentForName(agentName);
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

      // 追加聊天历史
      for (const m of session.messages) {
        messages.push({ role: m.role, content: m.content });
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
      this.sseEmitter.emit({ type: 'agent:start', data: { agent: agentName, stage: 'generating' } });

      let fullContent = '';
      try {
        const stream = getStream(agent, messages);
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

  // --- 知识库上下文 ---

  /**
   * 构建知识库上下文（全量），作为 system 设定注入对话。
   * 让写作/审稿 Agent 能感知角色、世界观、规则、伏笔等已有设定，避免自由发挥。
   */
  private async buildKnowledgeContext(): Promise<string> {
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
    return lines.join('\n');
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

  /** 根据 Agent 名称获取对应 Agent 实例（懒初始化） */
  private getAgentForName(name: AgentName): AnyAgent {
    const cached = this.agents[name];
    if (cached) return cached;

    const { client, model } = this.initLLM();

    let agent: AnyAgent;
    switch (name) {
      case 'brainstormer':
        agent = new BrainstormerAgent(client, { model, temperature: 1.0 });
        break;
      case 'auditor':
        agent = new AuditorAgent(client, { model, temperature: 0.3 });
        break;
      default:
        agent = new WriterAgent(client, { model, temperature: 0.7 });
        break;
    }

    this.agents[name] = agent;
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
