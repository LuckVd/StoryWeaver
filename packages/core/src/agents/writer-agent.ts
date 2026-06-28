import type { LLMClient, ChatOptions, ToolDefinition } from '../llm/types.js';
import type { Message, AgentConfig, ToolCall } from '../models/index.js';
import { BaseAgent } from './base-agent.js';
import { loadPrompt } from './prompts.js';

/**
 * Writer Agent — 续写 / 改写 / 修订
 *
 * 内置 Writer 系统 Prompt，通过 BaseAgent.chat / chatStream 与 LLM 交互。
 */
export class WriterAgent extends BaseAgent {
  readonly name = 'writer' as const;
  private systemPrompt: string;

  constructor(client: LLMClient, config: AgentConfig, configDir?: string) {
    super(client, config);
    this.systemPrompt = config.systemPrompt ?? loadPrompt('writer', configDir);
  }

  /** 非流式写作 */
  async write(messages: Message[], options?: ChatOptions): Promise<string> {
    return this.chat(
      [{ role: 'system', content: this.systemPrompt }, ...messages],
      options,
    );
  }

  /** 流式写作 */
  async *writeStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncGenerator<string> {
    yield* this.chatStream(
      [{ role: 'system', content: this.systemPrompt }, ...messages],
      options,
    );
  }

  /**
   * 带工具的流式写作(原生 function calling):续写时可查阅前文/设定/伏笔/大纲以保持准确。
   * 不支持 FC 的 provider 自动降级;最终仍只输出正文。
   */
  async *writeStreamWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    executor: (call: ToolCall) => Promise<string>,
    opts?: { maxIterations?: number; onToolCall?: (name: string, args: string) => void },
  ): AsyncGenerator<string> {
    const guidance = `\n\n【工具使用】续写/改写时可调用工具查阅前文/设定/伏笔/大纲以保持准确:${tools
      .map((t) => t.name)
      .join('、')}。需要时调用,但最终只输出小说正文,不要解释或标注。`;
    yield* this.chatWithToolsStream(
      [{ role: 'system', content: this.systemPrompt + guidance }, ...messages],
      tools,
      executor,
      opts,
    );
  }
}
