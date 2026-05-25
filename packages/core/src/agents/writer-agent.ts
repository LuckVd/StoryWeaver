import type { LLMClient, ChatOptions } from '../llm/types.js';
import type { Message, AgentConfig } from '../models/index.js';
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
}
