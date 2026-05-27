import { z } from 'zod';

// --- Book ---

export const createBookSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  genre: z.string().min(1, '类型不能为空'),
  language: z.string().min(1, '语言不能为空'),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
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
  status: z.enum(['approved', 'published'], { message: '状态只能转为 approved 或 published' }),
});
