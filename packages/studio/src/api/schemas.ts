import { z } from 'zod';

// --- Book ---

export const createBookSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  author: z.string().optional(),
  genre: z.string().min(1, '类型不能为空'),
  language: z.string().min(1, '语言不能为空'),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().optional(),
  genre: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  status: z.enum(['drafting', 'in_progress', 'completed', 'archived']).optional(),
});

// --- Volumes ---

export const createVolumeSchema = z.object({
  title: z.string().min(1, '卷标题不能为空'),
});

export const updateVolumeSchema = z.object({
  title: z.string().min(1, '卷标题不能为空'),
});

// --- Chapters ---

export const createChapterSchema = z.object({
  volume: z.number().int().positive('卷号必须为正整数'),
  title: z.string().min(1, '章节标题不能为空'),
});

export const updateChapterSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['approved', 'published', 'draft'], { message: '状态只能转为 approved、published 或 draft' }),
});

// --- Chat ---

export const createSessionSchema = z.object({
  chapterId: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
});

export const sendMessageSchema = z.object({
  message: z.string().min(1, '消息不能为空'),
  context: z.object({
    chapterRef: z.number().int().positive().optional(),
    agentOverride: z.enum(['writer', 'brainstormer', 'auditor', 'summarizer', 'curator']).optional(),
  }).optional(),
});

export const applySchema = z.object({
  messageId: z.string().min(1, '消息 ID 不能为空'),
  chapterId: z.number().int().positive('章节 ID 必须为正整数'),
  mode: z.enum(['append', 'replace'], { message: '模式只能为 append 或 replace' }),
  content: z.string().optional(),
});

// --- Versions ---

export const restoreVersionSchema = z.object({});

// --- Knowledge ---

export const worldSubCategorySchema = z.enum(['geography', 'power-system', 'factions', 'history', 'glossary']);

export const createCharacterSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  aliases: z.array(z.string()).optional(),
  description: z.string().min(1, '描述不能为空'),
  profile: z.string().optional(),
  firstAppearance: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateCharacterSchema = z.object({
  name: z.string().min(1).optional(),
  aliases: z.array(z.string()).optional(),
  description: z.string().min(1).optional(),
  profile: z.string().optional(),
  firstAppearance: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
});

export const createWorldSchema = z.object({
  category: worldSubCategorySchema,
  name: z.string().min(1, '名称不能为空'),
  content: z.string().min(1, '内容不能为空'),
  tags: z.array(z.string()).optional(),
});

export const updateWorldSchema = z.object({
  name: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export const createItemSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  description: z.string().min(1, '描述不能为空'),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const createHookSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  description: z.string().min(1, '描述不能为空'),
  status: z.enum(['active', 'resolved']),
  plantedAt: z.number().int().positive(),
  resolvedAt: z.number().int().positive().optional(),
  relatedEntities: z.array(z.string()).optional(),
});

export const updateHookSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'resolved']).optional(),
  resolvedAt: z.number().int().positive().optional(),
  relatedEntities: z.array(z.string()).optional(),
});

export const createRuleSchema = z.object({
  category: z.enum(['style', 'taboo', 'narrative_perspective', 'custom']),
  name: z.string().min(1, '名称不能为空'),
  content: z.string().min(1, '内容不能为空'),
  priority: z.enum(['high', 'medium', 'low']),
});

export const updateRuleSchema = z.object({
  category: z.enum(['style', 'taboo', 'narrative_perspective', 'custom']).optional(),
  name: z.string().min(1).optional(),
  content: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

export const createCustomSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1, '名称不能为空'),
  content: z.string().min(1, '内容不能为空'),
  tags: z.array(z.string()).optional(),
});

export const updateCustomSchema = z.object({
  name: z.string().min(1).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const outlineSchema: z.ZodType = z.object({
  id: z.string().min(1),
  type: z.enum(['book', 'volume', 'chapter']),
  title: z.string().min(1),
  summary: z.string().optional(),
  chapterId: z.number().int().positive().optional(),
  children: z.lazy(() => z.array(outlineSchema)).optional(),
  sortOrder: z.number().int().min(0),
});

export const createRelationSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.string().min(1, '关系类型不能为空'),
  direction: z.enum(['mutual', 'directed']),
  since: z.string().optional(),
  note: z.string().optional(),
});

export const updateRelationSchema = z.object({
  type: z.string().min(1).optional(),
  direction: z.enum(['mutual', 'directed']).optional(),
  since: z.string().optional(),
  note: z.string().optional(),
});

// --- Workspace ---

export const addChapterSchema = z.object({
  chapterId: z.number().int().positive('章节 ID 必须为正整数'),
});

export const publishSchema = z.object({
  chapterIds: z.array(z.number().int().positive()).min(1, '至少选择一个章节'),
  skipSummary: z.boolean().optional(),
});

// --- Search ---

export const VALID_SEARCH_SCOPES = ['all', 'chapters', 'knowledge', 'summaries'] as const;

// --- Query param helpers ---

export const VALID_WORLD_SUBS = ['geography', 'power-system', 'factions', 'history', 'glossary'] as const;

export function validateWorldSub(sub: string | undefined): string {
  if (!sub || !VALID_WORLD_SUBS.includes(sub as typeof VALID_WORLD_SUBS[number])) {
    throw new Error(`INVALID_WORLD_SUB`);
  }
  return sub;
}

export const customNameSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9\u4e00-\u9fff_-]+$/, '分类名只允许字母/数字/中文/下划线/连字符');
