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
} from '@storyweaver/core';
import type { AIOperationQueue } from '../queue.js';
import type { SSEEmitter } from '../sse.js';
import type { ChapterService } from './chapter-service.js';

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

    const aiContent = target.content ?? message.content;
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
