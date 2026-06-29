import {
  getActiveArc,
  getArcsFlat,
  type OutlineNode,
  type ToolDefinition,
  type ToolCall,
  type InMemorySearchEngine,
  type SummaryStorage,
} from '@storyweaver/core';
import type { KnowledgeService } from './knowledge-service.js';

/** 工具执行依赖(services) */
export interface ToolDeps {
  searchEngine?: InMemorySearchEngine;
  knowledgeService: KnowledgeService;
  summaryStorage: SummaryStorage;
  projectRoot: string;
}

/** 单个工具结果字符上限(防挤占上下文) */
const MAX_TOOL_RESULT_CHARS = 2000;

/**
 * 全 agent 通用只读探索工具(原生 function calling)。
 * writer/auditor/brainstormer 均可按需查阅知识库/历史章节/伏笔/大纲,提升准确度。
 */
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'search_knowledge',
    description: '按关键词检索知识库设定(角色/世界观/物品/规则等),返回相关条目。',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '检索关键词' } },
      required: ['query'],
    },
  },
  {
    name: 'get_character_history',
    description: '查询某角色的当前状态与近期出场章节,了解其发展脉络。',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: '角色名' } },
      required: ['name'],
    },
  },
  {
    name: 'search_chapters',
    description: '按关键词检索历史章节正文与摘要,回顾前文情节。',
    parameters: {
      type: 'object',
      properties: { keywords: { type: 'string', description: '检索关键词' } },
      required: ['keywords'],
    },
  },
  {
    name: 'get_hook_detail',
    description: '查询伏笔详情(可按状态 active/resolved 过滤),了解待回收悬念。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '伏笔名(可选)' },
        status: { type: 'string', enum: ['active', 'resolved'], description: '状态过滤(可选)' },
      },
    },
  },
  {
    name: 'get_outline_node',
    description: '查询剧情卷方向(粗粒度大纲):传章节号返回当前卷+下一卷方向;不传则列出所有剧情卷概要。',
    parameters: {
      type: 'object',
      properties: {
        chapterId: { type: 'number', description: '当前章节号(可选,用于定位当前卷)' },
      },
    },
  },
];

/** 创建工具执行器:按 toolCall.name 分发到对应 service,异常回填错误不中断循环 */
export function createToolExecutor(deps: ToolDeps): (call: ToolCall) => Promise<string> {
  return async (call) => {
    let args: Record<string, unknown> = {};
    try {
      args = call.arguments ? JSON.parse(call.arguments) : {};
    } catch {
      args = {};
    }
    try {
      switch (call.name) {
        case 'search_knowledge':
          return await runSearchKnowledge(deps, args);
        case 'get_character_history':
          return await runGetCharacterHistory(deps, args);
        case 'search_chapters':
          return await runSearchChapters(deps, args);
        case 'get_hook_detail':
          return await runGetHookDetail(deps, args);
        case 'get_outline_node':
          return await runGetOutlineNode(deps, args);
        default:
          return cap({ error: `未知工具: ${call.name}` });
      }
    } catch (err) {
      return cap({ error: err instanceof Error ? err.message : '工具执行失败' });
    }
  };
}

function str(v: unknown, d = ''): string {
  return typeof v === 'string' ? v : d;
}

function cap(obj: unknown): string {
  const s = JSON.stringify(obj);
  if (s.length <= MAX_TOOL_RESULT_CHARS) return s;
  // 截断时包装为合法 JSON(原前缀转字符串),避免坏 JSON 喂回模型
  return JSON.stringify({ truncated: true, partial: s.slice(0, MAX_TOOL_RESULT_CHARS) });
}

async function runSearchKnowledge(deps: ToolDeps, args: Record<string, unknown>): Promise<string> {
  const query = str(args.query).trim();
  if (!deps.searchEngine || !query) return cap({ results: [] });
  const hits = deps.searchEngine.search(query, 'knowledge').slice(0, 5);
  return cap({ results: hits.map((h) => ({ title: h.title, snippet: h.snippet })) });
}

async function runGetCharacterHistory(
  deps: ToolDeps,
  args: Record<string, unknown>,
): Promise<string> {
  const name = str(args.name).trim();
  if (!name) return cap({ error: '缺少 name 参数' });
  const [states, summaries] = await Promise.all([
    deps.summaryStorage.getCharacterStates(deps.projectRoot).catch(() => null),
    deps.summaryStorage.listChapterSummaries(deps.projectRoot).catch(() => []),
  ]);
  const state = states?.characters.find((c) => c.entity === name || c.entity.includes(name));
  const appearances = summaries
    .filter((s) => s.charactersPresent.some((c) => c.includes(name)))
    .sort((a, b) => a.chapter - b.chapter)
    .slice(-5)
    .map((s) => `第${s.chapter}章:${s.plotOutcome}`);
  return cap({ name, currentState: state?.currentState ?? {}, recentAppearances: appearances });
}

async function runSearchChapters(deps: ToolDeps, args: Record<string, unknown>): Promise<string> {
  const keywords = str(args.keywords).trim();
  if (!deps.searchEngine || !keywords) return cap({ results: [] });
  const [chapters, summaries] = await Promise.all([
    deps.searchEngine.search(keywords, 'chapters').slice(0, 5),
    deps.searchEngine.search(keywords, 'summaries').slice(0, 3),
  ]);
  return cap({
    chapters: chapters.map((h) => ({ title: h.title, snippet: h.snippet })),
    summaries: summaries.map((h) => ({ title: h.title, snippet: h.snippet })),
  });
}

async function runGetHookDetail(deps: ToolDeps, args: Record<string, unknown>): Promise<string> {
  const name = str(args.name).trim();
  const status = str(args.status);
  const hooks = await deps.knowledgeService.listHooks().catch(() => []);
  let filtered = hooks;
  if (status === 'active' || status === 'resolved') filtered = filtered.filter((h) => h.status === status);
  if (name) filtered = filtered.filter((h) => h.name.includes(name) || h.description.includes(name));
  return cap({
    hooks: filtered.slice(0, 8).map((h) => ({
      name: h.name,
      status: h.status,
      description: h.description,
      plantedAt: h.plantedAt,
    })),
  });
}

async function runGetOutlineNode(deps: ToolDeps, args: Record<string, unknown>): Promise<string> {
  const tree = await deps.knowledgeService.getOutline().catch(() => null);
  if (!tree) return cap({ error: '无大纲' });
  if (typeof args.chapterId === 'number') {
    // 传章节号:定位当前卷 + 后续规划卷
    const arc = getActiveArc(tree, args.chapterId);
    const pick = (n: OutlineNode | null) =>
      n ? { title: n.title, summary: n.summary, chapterRange: n.chapterRange } : null;
    return cap({ current: pick(arc.current), upcoming: arc.upcoming.map(pick) });
  }
  // 不传章节号:列出所有剧情卷概要(紧凑蓝图)
  return cap({
    arcs: getArcsFlat(tree).map((a) => ({
      title: a.title,
      summary: a.summary,
      chapterRange: a.chapterRange,
    })),
  });
}
