import type { AgentName, RoutingContext } from '../models/index.js';

/**
 * 关键词路由：将用户消息映射到目标 Agent
 *
 * 优先级：
 * 1. 斜杠命令精确匹配
 * 2. 中英文关键词正则匹配
 * 3. LLM 兜底分类（Phase 1 默认返回 'writer'）
 */
export async function routeUserMessage(
  input: string,
  _context?: RoutingContext,
): Promise<AgentName> {
  const trimmed = input.trim();

  // 1. 斜杠命令
  if (/^\/write/i.test(trimmed)) return 'writer';
  if (/^\/audit/i.test(trimmed)) return 'auditor';
  if (/^\/brainstorm/i.test(trimmed)) return 'brainstormer';

  // 2. 关键词规则（中英文高频意图）
  if (/(续写|继续写|写下去|接着写|继续|write|continue)/i.test(trimmed)) return 'writer';
  if (/(改写|修改|调整|重写|润色|rewrite|revise)/i.test(trimmed)) return 'writer';
  if (/(审稿|检查|审查|审核|audit|review)/i.test(trimmed)) return 'auditor';
  if (/(构思|想想|设计|头脑风暴|灵感|brainstorm)/i.test(trimmed)) return 'brainstormer';
  if (/(角色|设定|知识库|世界观|curator)/i.test(trimmed)) return 'curator';
  if (/(总结|摘要|概括|summarize)/i.test(trimmed)) return 'summarizer';

  // 3. LLM 兜底（Phase 1 留 TODO，默认 writer）
  return 'writer';
}
