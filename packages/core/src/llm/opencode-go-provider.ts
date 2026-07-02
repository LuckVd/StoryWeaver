import { OpenAIClient } from './openai-provider.js';
import type { LLMProvider } from './types.js';

/**
 * OpenCode Go Provider(原生支持)
 *
 * OpenAI 兼容协议(OpenCode zen/go 套餐),预设 baseUrl + 默认模型。
 * OpenCode Go 是 OpenCode(sst)提供的多模型统一入口,含 DeepSeek / GPT / Claude /
 * Gemini / Qwen 等,月付套餐。前端选择 opencode-go 后只需填 API Key 即可使用。
 * 模型 id 不确定时可在设置页点「获取可用模型」拉取真实列表(走 GET {baseUrl}/models)。
 */
const OPENCODE_GO_BASE_URL = 'https://opencode.ai/zen/go/v1';
const OPENCODE_GO_DEFAULT_MODEL = 'deepseek-v4-flash';

export class OpenCodeGoProvider implements LLMProvider {
  readonly name = 'opencode-go';

  createClient(apiKey: string, baseUrl?: string) {
    return new OpenAIClient(apiKey, baseUrl ?? OPENCODE_GO_BASE_URL, OPENCODE_GO_DEFAULT_MODEL);
  }
}
