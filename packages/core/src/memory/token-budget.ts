import type { TokenBudget } from '../models/memory.js';

/**
 * Token 预算管理（G03-S05）
 *
 * 不同模型上下文窗口差异巨大，长篇记忆需要按窗口动态分配 Layer3 远期记忆预算。
 * 见 tech-spec §5.7。
 */

/** 常见模型上下文窗口（tokens） */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4.1': 1047576,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16385,
  'claude-3-5-sonnet': 200000,
  'claude-sonnet-4': 200000,
  'claude-opus-4': 200000,
  'glm-4': 128000,
  'glm-4-plus': 128000,
  'glm-4-long': 1000000,
  'deepseek-chat': 64000,
  'qwen-max': 32768,
  'qwen-plus': 131072,
};

/** 未知模型回退窗口大小 */
const DEFAULT_CONTEXT_WINDOW = 128000;

/**
 * 获取模型上下文窗口大小。
 * 先精确匹配，再前缀匹配（处理带日期/版本后缀的模型名），否则回退默认值。
 */
export function getModelContextWindow(model: string): number {
  if (MODEL_CONTEXT_WINDOWS[model]) return MODEL_CONTEXT_WINDOWS[model];
  const key = Object.keys(MODEL_CONTEXT_WINDOWS).find((k) => model.startsWith(k));
  return key ? MODEL_CONTEXT_WINDOWS[key] : DEFAULT_CONTEXT_WINDOW;
}

/**
 * 计算 Layer3 远期记忆可用 token 预算。
 *
 * 预留：systemPrompt(500) + Layer1 + Layer2 + 对话历史 + 输出保留(4000)。
 * 剩余空间的 70% 给 Layer3（留余量避免溢出）。窗口不足时返回 0（不返回负数）。
 */
export function calcLayer3Budget(
  model: string,
  layer1: number,
  layer2: number,
  dialogHistory: number,
): number {
  const window = getModelContextWindow(model);
  const reserved = 500 + layer1 + layer2 + dialogHistory + 4000;
  return Math.max(0, Math.floor((window - reserved) * 0.7));
}

/**
 * 组装完整 TokenBudget（使用默认分配比例）。
 */
export function buildTokenBudget(
  model: string,
  options: { layer1?: number; layer2?: number; dialogHistory?: number } = {},
): TokenBudget {
  const layer1 = options.layer1 ?? 3000;
  const layer2 = options.layer2 ?? 6000;
  const dialogHistory = options.dialogHistory ?? 3500;
  return {
    total: getModelContextWindow(model),
    systemPrompt: 500,
    layer1,
    layer2,
    layer3: calcLayer3Budget(model, layer1, layer2, dialogHistory),
    outputReserve: 4000,
  };
}
