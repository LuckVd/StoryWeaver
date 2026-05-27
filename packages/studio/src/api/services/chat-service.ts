import { randomUUID } from 'node:crypto';
import {
  createLLMClient,
  WriterAgent,
  routeUserMessage,
  type LLMClient,
  type AgentName,
  type Message,
  type ChatSession,
  type ChatMessage,
  type ModelConfig,
  type AgentConfig,
  type SSEEvent,
} from '@storyweaver/core';
import type { AIOperationQueue } from '../queue.js';
import type { SSEEmitter } from '../sse.js';
import type { ChapterService } from './chapter-service.js';

/**
 * 对话服务层
 *
 * 管理会话、执行 AI 对话（路由 → Agent → 流式输出）、应用内容到章节。
 */
export class ChatService {
  private sessions = new Map<string, ChatSession>();
  private llmClient: LLMClient | null = null;
  private writerAgent: WriterAgent | null = null;

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
    const agentName: AgentName = context?.agentOverride ?? await routeUserMessage(userContent);

    // 入队执行
    this.aiQueue.enqueue(async () => {
      const agent = this.getAgent();
      const messages: Message[] = session.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // 广播开始
      this.sseEmitter.emit({ type: 'agent:start', data: { agent: agentName, stage: 'generating' } });

      let fullContent = '';
      try {
        for await (const token of agent.writeStream(messages)) {
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
      this.sseEmitter.emit({ type: 'agent:complete', data: { agent: agentName, result: null } });
    });
  }

  // --- Apply ---

  /** 将 AI 回复应用到章节 */
  async applyMessage(
    sessionId: string,
    messageId: string,
    target: { chapterId: number; mode: 'append' | 'replace'; content?: string },
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const message = session.messages.find((m) => m.id === messageId);
    if (!message || message.role !== 'assistant') {
      throw new Error('MESSAGE_NOT_FOUND');
    }

    const aiContent = target.content ?? message.content;
    const volume = await this.chapterService.findVolume(target.chapterId);
    if (volume === null) {
      throw new Error('CHAPTER_NOT_FOUND');
    }

    if (target.mode === 'append') {
      const chapter = await this.chapterService.read(volume, target.chapterId);
      if (!chapter) {
        throw new Error('CHAPTER_NOT_FOUND');
      }
      await this.chapterService.update(volume, target.chapterId, {
        content: chapter.content + '\n' + aiContent,
      });
    } else {
      await this.chapterService.update(volume, target.chapterId, {
        content: aiContent,
      });
    }
  }

  // --- LLM 初始化 ---

  private getAgent(): WriterAgent {
    if (this.writerAgent) return this.writerAgent;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY 未配置，请在 .env 文件中设置');
    }

    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
    const config: ModelConfig = {
      id: model,
      name: model,
      service: 'openai',
      apiKey,
    };

    this.llmClient = createLLMClient(config);
    const agentConfig: AgentConfig = { model, temperature: 0.7 };
    this.writerAgent = new WriterAgent(this.llmClient, agentConfig);
    return this.writerAgent;
  }
}
