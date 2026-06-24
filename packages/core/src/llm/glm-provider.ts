import { OpenAIClient } from './openai-provider.js';
import type { LLMProvider } from './types.js';

/**
 * 智谱 GLM Provider(原生支持)
 *
 * OpenAI 兼容协议(CodePlan paas/v4),预设 baseUrl + 默认模型。
 * 前端选择 glm 后只需填 API Key 即可使用。
 */
const GLM_BASE_URL = 'https://open.bigmodel.cn/api/coding/paas/v4';
const GLM_DEFAULT_MODEL = 'glm-4-flash';

export class GLMProvider implements LLMProvider {
  readonly name = 'glm';

  createClient(apiKey: string, baseUrl?: string) {
    return new OpenAIClient(apiKey, baseUrl ?? GLM_BASE_URL, GLM_DEFAULT_MODEL);
  }
}
