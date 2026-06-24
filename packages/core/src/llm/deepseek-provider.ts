import { OpenAIClient } from './openai-provider.js';
import type { LLMProvider } from './types.js';

/**
 * DeepSeek Provider(原生支持)
 *
 * OpenAI 兼容协议,预设 baseUrl + 默认模型。
 * 前端选择 deepseek 后只需填 API Key 即可使用。
 */
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat';

export class DeepSeekProvider implements LLMProvider {
  readonly name = 'deepseek';

  createClient(apiKey: string, baseUrl?: string) {
    return new OpenAIClient(apiKey, baseUrl ?? DEEPSEEK_BASE_URL, DEEPSEEK_DEFAULT_MODEL);
  }
}
