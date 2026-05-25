# Current Goal

## Goal

G01-S05 — BaseAgent + WriterAgent

在 `packages/core/src/agents/` 下实现 Agent 系统基础：BaseAgent 抽象基类（chat/chatStream/chatStructured）、WriterAgent 具体实现、关键词路由函数、Writer 默认 Prompt。

## Current State

G01-S05 已完成，等待同步。下一个目标：G01-S06 (Hono API Server 基础)。

## Chosen Approach

按技术方案 6.4 节设计：
- `BaseAgent` 持有 `LLMClient` 实例 + `AgentConfig`，提供 `chat()`/`chatStream()`/`chatStructured<T>()` 三个 protected 方法
- `WriterAgent` 继承 BaseAgent，注入 Writer 专属系统 Prompt
- 路由函数 `routeUserMessage()`：斜杠命令 → 关键词正则 → LLM 兜底（Phase 1 仅实现前两层）
- 默认 Prompt 内嵌在代码中，`config/prompts/` 覆盖机制留给后续子目标

## Acceptance Criteria

- [x] `BaseAgent` 抽象基类：`chat()` 返回 `string`，`chatStream()` 返回 `AsyncGenerator<string>`，`chatStructured<T>()` 用 Zod 校验
- [x] `WriterAgent` 继承 BaseAgent，内置 Writer 系统 Prompt
- [x] `routeUserMessage()` 关键词路由（斜杠命令 + 正则匹配，中英文）
- [x] `loadPrompt()` 函数：默认 Prompt 内嵌，支持 `config/prompts/` 文件覆盖
- [x] vitest 单元测试（mock LLMClient）
- [x] `pnpm build` 零错误

## Test Plan

- vitest 单元测试，mock `LLMClient`：
  - `BaseAgent.chat()` 正常调用 + 返回 content 提取
  - `BaseAgent.chatStream()` 正常 yield token
  - `BaseAgent.chatStructured()` Zod 解析成功 + 失败重试
  - `WriterAgent` 系统注入 + 模型/温度参数传递
  - `routeUserMessage()` 覆盖所有路由规则（斜杠/关键词）
  - `routeUserMessage()` 未知输入走 LLM 兜底
- `pnpm build` 零错误

## Steps

### Step 1: 创建 agents 目录结构

```
packages/core/src/agents/
├── index.ts              # 统一导出
├── base-agent.ts         # BaseAgent 抽象基类
├── writer-agent.ts       # WriterAgent 实现
├── router.ts             # 关键词路由函数
├── prompts.ts            # 默认 Prompt + 加载逻辑
└── __tests__/
    ├── base-agent.test.ts
    ├── writer-agent.test.ts
    └── router.test.ts
```

### Step 2: 检查并安装 zod 依赖

`chatStructured<T>()` 需要 `zod` 做 schema 校验。检查 core package.json 是否已有，没有则添加。

### Step 3: 实现 BaseAgent (base-agent.ts)

```typescript
import type { LLMClient, ChatOptions } from '../llm/types.js';
import type { Message, AgentConfig } from '../models/index.js';
import { z } from 'zod';

export abstract class BaseAgent {
  protected client: LLMClient;
  protected config: AgentConfig;

  constructor(client: LLMClient, config: AgentConfig) {
    this.client = client;
    this.config = config;
  }

  protected async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const result = await this.client.chatCompletion(messages, {
      model: this.config.model,
      temperature: this.config.temperature ?? 0.7,
      ...options,
    });
    return result.content;
  }

  protected async *chatStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    yield* this.client.chatCompletionStream(messages, {
      model: this.config.model,
      temperature: this.config.temperature ?? 0.7,
      ...options,
    });
  }

  protected async chatStructured<T>(
    messages: Message[],
    schema: z.ZodSchema<T>,
    maxRetries = 3,
  ): Promise<T> {
    const mutableMessages = [...messages];
    for (let i = 0; i < maxRetries; i++) {
      const raw = await this.chat(mutableMessages);
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      mutableMessages.push({
        role: 'user',
        content: `输出格式错误，请重新生成：${parsed.error.message}`,
      });
    }
    throw new Error('Failed to get structured output after retries');
  }
}
```

### Step 4: 实现 prompts (prompts.ts)

- 默认 Writer Prompt 内嵌为字符串常量
- `loadPrompt(agentName, customDir?)` 函数：优先读文件，不存在则返回默认

### Step 5: 实现 WriterAgent (writer-agent.ts)

```typescript
export class WriterAgent extends BaseAgent {
  readonly name = 'writer' as const;

  constructor(client: LLMClient, config: AgentConfig) {
    super(client, config);
  }

  async write(messages: Message[]): Promise<string> {
    const systemPrompt = loadPrompt('writer');
    return this.chat([
      { role: 'system', content: systemPrompt },
      ...messages,
    ]);
  }

  async *writeStream(messages: Message[]): AsyncGenerator<string> {
    const systemPrompt = loadPrompt('writer');
    yield* this.chatStream([
      { role: 'system', content: systemPrompt },
      ...messages,
    ]);
  }
}
```

### Step 6: 实现 router (router.ts)

关键词路由函数：
1. 斜杠命令精确匹配（`/write`、`/audit`、`/brainstorm`）
2. 中英文关键词正则匹配（续写/改写/审稿/构思等）
3. LLM 兜底分类（Phase 1 留 TODO，默认返回 `'writer'`）

### Step 7: 编写单元测试

- mock `LLMClient`，验证调用参数、返回值
- 覆盖所有路由规则
- `chatStructured` 重试逻辑

### Step 8: 更新导出 + 验证构建

- `agents/index.ts` 统一导出
- `src/index.ts` 增加 `export * from './agents/index.js'`
- `pnpm build` 零错误

## Tasks

- [x] 创建 agents/ 目录结构
- [x] 检查/安装 zod 依赖
- [x] 实现 BaseAgent 抽象基类
- [x] 实现 prompts（默认 Prompt + loadPrompt）
- [x] 实现 WriterAgent
- [x] 实现关键词路由 router
- [x] 编写单元测试
- [x] 更新导出 + 验证构建

## Blockers

- 无（依赖 G01-S04 已完成）

## Open Questions

- 无

## Parent Goal

- G01 — Phase 1: MVP (roadmap)
- 完成后继续 → G01-S06 Hono API Server 基础

## Sync Notes

- 目标激活自 roadmap G01-S05
