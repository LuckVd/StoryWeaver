import type { LLMClient, ChatOptions, ToolDefinition } from '../llm/types.js';
import type { Message, AgentConfig, ToolCall } from '../models/index.js';
import { BaseAgent } from './base-agent.js';
import { loadPrompt } from './prompts.js';

/**
 * Brainstormer Agent — 构思 / 创意发散
 *
 * 高温度（1.0），用于情节方向、角色发展、世界观扩展等创意任务。
 */
export class BrainstormerAgent extends BaseAgent {
  readonly name = 'brainstormer' as const;
  private systemPrompt: string;

  constructor(client: LLMClient, config: AgentConfig, configDir?: string) {
    super(client, { ...config, temperature: config.temperature ?? 1.0 });
    this.systemPrompt = config.systemPrompt ?? loadPrompt('brainstormer', configDir);
  }

  /** 非流式构思 */
  async brainstorm(messages: Message[], options?: ChatOptions): Promise<string> {
    return this.chat(
      [{ role: 'system', content: this.systemPrompt }, ...messages],
      options,
    );
  }

  /** 流式构思 */
  async *brainstormStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncGenerator<string> {
    yield* this.chatStream(
      [{ role: 'system', content: this.systemPrompt }, ...messages],
      options,
    );
  }

  /**
   * 带工具的流式构思(原生 function calling):允许 AI 按需查阅知识库/历史章节/伏笔/大纲。
   * 内部走 BaseAgent.chatWithToolsStream 工具循环;不支持 FC 的 provider 会自动降级(忽略工具直接回答)。
   */
  async *brainstormStreamWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    executor: (call: ToolCall) => Promise<string>,
    opts?: { maxIterations?: number; onToolCall?: (name: string, args: string) => void },
  ): AsyncGenerator<string> {
    const guidance = `\n\n【工具使用】构思时可调用工具按需查阅资料以丰富灵感:${tools
      .map((t) => t.name)
      .join('、')}。需要时调用,无需则直接回答。`;
    yield* this.chatWithToolsStream(
      [{ role: 'system', content: this.systemPrompt + guidance }, ...messages],
      tools,
      executor,
      opts,
    );
  }
}
