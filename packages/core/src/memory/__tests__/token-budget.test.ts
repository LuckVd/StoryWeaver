import { describe, it, expect } from 'vitest';
import { getModelContextWindow, calcLayer3Budget, buildTokenBudget } from '../token-budget.js';

describe('getModelContextWindow', () => {
  it('精确匹配已知模型', () => {
    expect(getModelContextWindow('gpt-4o')).toBe(128000);
    expect(getModelContextWindow('glm-4-plus')).toBe(128000);
    expect(getModelContextWindow('claude-sonnet-4')).toBe(200000);
  });

  it('前缀匹配带后缀的模型名', () => {
    expect(getModelContextWindow('gpt-4o-2024-08-06')).toBe(128000);
    expect(getModelContextWindow('claude-sonnet-4-5-20250929')).toBe(200000);
  });

  it('未知模型回退默认 128000', () => {
    expect(getModelContextWindow('totally-unknown-model')).toBe(128000);
  });
});

describe('calcLayer3Budget', () => {
  it('正确计算剩余空间的 70%', () => {
    // window 128000, reserved = 500+3000+6000+3500+4000 = 17000
    // (128000-17000)*0.7 = 111000*0.7 = 77700
    expect(calcLayer3Budget('gpt-4o', 3000, 6000, 3500)).toBe(77700);
  });

  it('小窗口模型返回较小预算', () => {
    // qwen-max 32768, reserved 17000, (32768-17000)*0.7 = 15768*0.7 = 11037.6 → 11037
    expect(calcLayer3Budget('qwen-max', 3000, 6000, 3500)).toBe(11037);
  });

  it('窗口不足以容纳保留值时返回 0（不返回负数）', () => {
    expect(calcLayer3Budget('qwen-max', 30000, 30000, 30000)).toBe(0);
  });
});

describe('buildTokenBudget', () => {
  it('组装完整预算对象', () => {
    const b = buildTokenBudget('gpt-4o');
    expect(b.total).toBe(128000);
    expect(b.systemPrompt).toBe(500);
    expect(b.layer1).toBe(3000);
    expect(b.layer2).toBe(6000);
    expect(b.outputReserve).toBe(4000);
    expect(b.layer3).toBe(77700);
  });

  it('自定义分配覆盖默认值', () => {
    const b = buildTokenBudget('gpt-4o', { layer1: 2000, layer2: 4000, dialogHistory: 1000 });
    expect(b.layer1).toBe(2000);
    expect(b.layer2).toBe(4000);
  });
});
