/**
 * 配置 (Config) 类型定义
 *
 * 对应 novel.yaml 中的模型配置和 config/ 目录。
 */

/** LLM 模型配置 */
export interface ModelConfig {
  /** 模型标识，如 "gpt-4o" */
  id: string;
  /** 显示名称 */
  name: string;
  /** 服务商："openai" | "anthropic" | "ollama" | ... */
  service: string;
  /** API Key（明文存于 config/models.json，已 gitignore；对外脱敏展示 ***xxxx） */
  apiKey: string;
  /** 自定义 endpoint */
  baseUrl?: string;
  /** 上下文窗口大小（tokens） */
  contextWindow?: number;
}

/** Agent 模型分配配置 */
export interface AgentModelConfig {
  /** 默认模型 ID */
  default: string;
  /** 各 Agent 单独覆盖 */
  overrides?: {
    brainstormer?: string;
    writer?: string;
    auditor?: string;
    summarizer?: string;
    curator?: string;
    router?: string;
  };
}

/** novel.yaml 顶层配置结构 */
export interface NovelConfig {
  title: string;
  genre: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  nextChapterId: number;
  /** 多章综合总结间隔（章节数） */
  batchSummaryInterval?: number;
  /** 默认模型 ID */
  defaultModel: string;
  /** Agent 模型分配 */
  agentOverrides?: AgentModelConfig['overrides'];
}
