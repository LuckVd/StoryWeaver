import type { LLMClient, ChatOptions, ToolDefinition } from '../llm/types.js';
import type { Message, AgentConfig, ToolCall } from '../models/index.js';
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

  /**
   * 带工具的流式补全(原生 function calling 循环)。
   *
   * 循环调用 LLM:有 toolCalls 则经 executor 执行并追加 tool 消息后继续;
   * 无 toolCalls(或迭代用尽)时输出最终回答(伪流式分段 yield,
   * 避开流式 tool_calls 增量累积的复杂度)。
   * 仅当 client.supportsTools 为真时使用;否则调用方应回退 chatStream。
   */
  protected async *chatWithToolsStream(
    messages: Message[],
    tools: ToolDefinition[],
    executor: (call: ToolCall) => Promise<string>,
    opts?: { maxIterations?: number; onToolCall?: (name: string, args: string) => void },
  ): AsyncGenerator<string> {
    // 至少 2 轮:1 次工具调用 + 1 次最终生成;=1 会无法在调工具后生成最终回答
    const maxIterations = Math.max(2, opts?.maxIterations ?? 5);
    const history = [...messages];
    for (let i = 0; i < maxIterations; i++) {
      const forceFinal = i === maxIterations - 1;
      const result = await this.client.chatCompletion(history, {
        model: this.config.model,
        temperature: this.config.temperature ?? 0.7,
        tools,
        toolChoice: forceFinal ? 'none' : 'auto',
      });
      const calls = result.toolCalls ?? [];
      if (calls.length === 0 || forceFinal) {
        yield* chunkStream(result.content);
        return;
      }
      history.push({ role: 'assistant', content: result.content, toolCalls: calls });
      for (const call of calls) {
        opts?.onToolCall?.(call.name, call.arguments);
        let toolResult: string;
        try {
          toolResult = await executor(call);
        } catch (err) {
          toolResult = JSON.stringify({
            error: err instanceof Error ? err.message : '工具执行失败',
          });
        }
        history.push({
          role: 'tool',
          content: toolResult,
          toolCallId: call.id,
          name: call.name,
        });
      }
    }
  }
}

/** 将文本按句号/换行分段 yield,模拟流式打字效果(用于工具循环的最终回答) */
function* chunkStream(text: string): Generator<string> {
  const parts = text.split(/(?<=[。！？\n.!?])/);
  for (const p of parts) {
    if (p) yield p;
  }
}
