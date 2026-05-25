# Current Goal

## Goal

G01-S04 — LLM 抽象层

在 `packages/core/src/llm/` 下实现 LLM 抽象层，包含 LLMClient 接口、OpenAI Provider、Token 计数工具。Phase 1 仅支持 OpenAI。

## Current State

G01-S04 已完成并同步。等待激活下一个目标 G01-S05 (BaseAgent + WriterAgent)。

## Chosen Approach

按技术方案设计：定义 `LLMClient` 接口 + `LLMProvider` 接口 + `OpenAIProvider` 实现。使用 `openai` SDK 完成实际 API 调用。Token 计数通过 OpenAI 响应的 `usage` 字段获取，暂不做预估算（Phase 3 Token Budget 时再加）。

## Acceptance Criteria

- [x] `LLMClient` 接口定义：`chatCompletion` + `chatCompletionStream`
- [x] `OpenAIProvider` 实现，支持普通补全和流式补全
- [x] `createLLMClient` 工厂函数
- [x] `TokenUsage` 类型 + 从响应中提取 token 使用量
- [x] 基础重试逻辑（网络错误指数退避）
- [x] API Key 从参数传入，不硬编码
- [x] vitest 单元测试（mock OpenAI SDK）
- [x] `pnpm build` 零错误

## Test Plan

- vitest 单元测试，mock `openai` SDK：
  - `chatCompletion` 正常返回
  - `chatCompletionStream` 流式返回
  - Token usage 正确提取
  - 重试逻辑验证（模拟错误后重试成功）
  - API Key 正确传递
- `pnpm build` 零错误

## Steps

### Step 1: 创建 llm 目录结构

```
packages/core/src/llm/
├── index.ts              # 统一导出
├── types.ts              # ChatOptions, TokenUsage, LLMClient, LLMProvider 接口
├── openai-provider.ts    # OpenAI Provider 实现
├── factory.ts            # createLLMClient 工厂函数
└── __tests__/
    ├── openai-provider.test.ts
    └── factory.test.ts
```

### Step 2: 定义类型和接口 (types.ts)

```typescript
interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface ChatResult {
  content: string;
  usage?: TokenUsage;
}

interface LLMClient {
  chatCompletion(messages: Message[], options?: ChatOptions): Promise<ChatResult>;
  chatCompletionStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string>;
}

interface LLMProvider {
  name: string;
  createClient(config: ModelConfig): LLMClient;
}
```

### Step 3: 实现 OpenAIProvider (openai-provider.ts)

- 使用 `openai` SDK 的 `OpenAI` 类
- `chatCompletion`：调用 `client.chat.completions.create`，提取 content + usage
- `chatCompletionStream`：调用 `client.chat.completions.create({ stream: true })`，yield 每个 chunk 的 delta content
- 内置重试：网络错误时指数退避重试（最多 3 次，初始 1s，倍增）

### Step 4: 实现 createLLMClient 工厂 (factory.ts)

```typescript
const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  // anthropic, ollama 等在 Phase 4 添加
};

function createLLMClient(config: ModelConfig): LLMClient {
  const provider = providers[config.service];
  if (!provider) throw new Error(`Unknown provider: ${config.service}`);
  return provider.createClient(config);
}
```

### Step 5: 编写单元测试

- mock OpenAI SDK，验证调用参数、返回值、流式输出
- 验证重试逻辑

### Step 6: 更新导出 + 验证构建

- `llm/index.ts` 统一导出
- `src/index.ts` 增加 `export * from './llm/index.js'`
- `pnpm build` 零错误

## Tasks

- [x] 创建 llm/ 目录结构
- [x] 定义 types.ts 接口
- [x] 实现 OpenAIProvider
- [x] 实现 createLLMClient 工厂
- [x] 编写单元测试
- [x] 更新导出 + 验证构建

## Blockers

- 无（依赖 G01-S01 已完成）

## Open Questions

- 无

## Parent Goal

- G01 — Phase 1: MVP (roadmap)
- 完成后继续 → G01-S05 BaseAgent + WriterAgent

## Sync Notes

- 目标激活自 roadmap G01-S04
- 2026-05-25: 同步完成，测试 43 pass，安全扫描无阻塞，死代码 1 HIGH（可延后）
