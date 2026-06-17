import type { LLMClient, ChatOptions } from '../llm/types.js';
import type { Message, AgentConfig } from '../models/index.js';
import { z } from 'zod';

/**
 * Agent 抽象基类
 *
 * 持有 LLMClient 实例和 AgentConfig，提供 chat / chatStream / chatStructured
 * 三个 protected 方法供具体 Agent 子类使用。
 */
export abstract class BaseAgent {
  protected client: LLMClient;
  protected config: AgentConfig;

  constructor(client: LLMClient, config: AgentConfig) {
    this.client = client;
    this.config = config;
  }

  /** 非流式补全，返回 content 字符串 */
  protected async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const result = await this.client.chatCompletion(messages, {
      model: this.config.model,
      temperature: this.config.temperature ?? 0.7,
      ...options,
    });
    return result.content;
  }

  /** 流式补全，yield 每个 token */
  protected async *chatStream(
    messages: Message[],
    options?: ChatOptions,
  ): AsyncGenerator<string> {
    yield* this.client.chatCompletionStream(messages, {
      model: this.config.model,
      temperature: this.config.temperature ?? 0.7,
      ...options,
    });
  }

  /** 结构化输出：用 Zod schema 校验，最多重试 maxRetries 次 */
  protected async chatStructured<T>(
    messages: Message[],
    schema: z.ZodSchema<T>,
    maxRetries = 3,
  ): Promise<T> {
    const mutableMessages = [...messages];
    for (let i = 0; i < maxRetries; i++) {
      const raw = await this.chat(mutableMessages);
      // glm 等推理模型可能用 ```json 代码块包裹或附带解释文字，提取首个 JSON 对象再解析
      const match = raw.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : raw;
      let parsed: z.SafeParseReturnType<T, T>;
      try {
        parsed = schema.safeParse(JSON.parse(jsonStr));
      } catch {
        mutableMessages.push({
          role: 'user',
          content: '输出格式错误：无法解析 JSON，请重新生成。',
        });
        continue;
      }
      if (parsed.success) return parsed.data;
      mutableMessages.push({
        role: 'user',
        content: `输出格式错误，请重新生成：${parsed.error.message}`,
      });
    }
    throw new Error('Failed to get structured output after retries');
  }
}
