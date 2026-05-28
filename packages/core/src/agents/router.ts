import type { AgentName, RoutingContext } from '../models/index.js';
import type { LLMClient } from '../llm/types.js';

const VALID_AGENTS: AgentName[] = ['writer', 'brainstormer', 'auditor', 'curator', 'summarizer'];

/**
 * 关键词路由：将用户消息映射到目标 Agent
 *
 * 优先级：
 * 1. 斜杠命令精确匹配
 * 2. 中英文关键词正则匹配
 * 3. LLM 兜底分类（可选，无 LLM 时返回 'writer'）
 */
export async function routeUserMessage(
  input: string,
  _context?: RoutingContext,
  llmClient?: LLMClient,
): Promise<AgentName> {
  const trimmed = input.trim();
  if (!trimmed) return 'writer';

  // 1. 斜杠命令
  if (/^\/write/i.test(trimmed)) return 'writer';
  if (/^\/audit/i.test(trimmed)) return 'auditor';
  if (/^\/brainstorm/i.test(trimmed)) return 'brainstormer';
  if (/^\/summarize/i.test(trimmed)) return 'summarizer';
  if (/^\/curate/i.test(trimmed)) return 'curator';

  // 2. 关键词规则（中英文高频意图）
  if (/(续写|继续写|写下去|接着写|继续|write|continue)/i.test(trimmed)) return 'writer';
  if (/(改写|修改|调整|重写|润色|删掉|删除|去掉|展开|扩展|rewrite|revise|expand)/i.test(trimmed)) return 'writer';
  if (/(审稿|检查|审查|审核|比较|对比|挑错|audit|review|check)/i.test(trimmed)) return 'auditor';
  if (/(构思|想想|设计|头脑风暴|灵感|建议|brainstorm|idea)/i.test(trimmed)) return 'brainstormer';
  if (/(角色|设定|知识库|世界观|整理|curator|knowledge)/i.test(trimmed)) return 'curator';
  if (/(总结|摘要|概括|回顾|summarize|summary)/i.test(trimmed)) return 'summarizer';

  // 3. LLM 兜底
  if (llmClient) {
    return classifyIntentWithLLM(trimmed, llmClient);
  }

  return 'writer';
}

/** LLM 兜底分类超时（毫秒） */
const LLM_ROUTER_TIMEOUT = 3000;

/**
 * 使用 LLM 分类用户意图
 *
 * 发送简短 prompt 让 LLM 判断应交给哪个 Agent。
 * 超时或错误时降级为 'writer'。
 */
async function classifyIntentWithLLM(
  input: string,
  client: LLMClient,
): Promise<AgentName> {
  const prompt = `判断以下用户消息应由哪个 AI Agent 处理。只输出一个词：writer（续写/改写）、brainstormer（构思/灵感）、auditor（审稿/检查）、curator（知识库/设定）、summarizer（总结/摘要）。

用户消息：${input}

Agent:`;

  try {
    const result = await Promise.race([
      client.chatCompletion(
        [{ role: 'user', content: prompt }],
        { model: 'router', temperature: 0, max_tokens: 20 },
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), LLM_ROUTER_TIMEOUT),
      ),
    ]);

    const text = result.content.trim().toLowerCase();
    const agent = VALID_AGENTS.find((a) => text.includes(a));
    return agent ?? 'writer';
  } catch {
    return 'writer';
  }
}
