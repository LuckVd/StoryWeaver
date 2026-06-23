import type { ModelConfig } from '../models/index.js';
import type { LLMClient, LLMProvider } from './types.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OllamaProvider } from './ollama-provider.js';

/**
 * 已注册的 Provider 列表
 *
 * openai(含兼容 baseUrl,如智谱 GLM)、anthropic、ollama(本地)。
 */
const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  ollama: new OllamaProvider(),
};

/**
 * 注册新的 LLM Provider
 */
export function registerProvider(provider: LLMProvider): void {
  providers[provider.name] = provider;
}

/**
 * 根据 ModelConfig 创建 LLM 客户端
 *
 * @throws {Error} 未知的 service 类型
 */
export function createLLMClient(config: ModelConfig): LLMClient {
  const provider = providers[config.service];
  if (!provider) {
    throw new Error(`Unknown LLM provider: "${config.service}". Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider.createClient(config.apiKey, config.baseUrl);
}
