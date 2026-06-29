import { resolve, normalize, relative } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';

/**
 * 存储路径安全工具
 *
 * 提供路径安全校验（防路径遍历）和路径生成辅助方法。
 * 所有存储模块的文件操作必须通过此工具生成安全路径。
 */

/** 路径遍历错误 */
export class PathTraversalError extends Error {
  constructor(public readonly projectRoot: string, public readonly attemptedPath: string) {
    super(`Path traversal detected: "${attemptedPath}" is outside project root "${projectRoot}"`);
    this.name = 'PathTraversalError';
  }
}

/**
 * 解析并校验路径安全性
 *
 * @param projectRoot 项目根目录（绝对路径）
 * @param relativePath 相对路径
 * @returns 安全的绝对路径
 * @throws {PathTraversalError} 路径遍历时抛出
 */
export function resolveSafe(projectRoot: string, relativePath: string): string {
  const normalizedRoot = resolve(projectRoot);
  const resolved = resolve(normalizedRoot, relativePath);
  const rel = relative(normalizedRoot, resolved);

  // relative() 返回以 ".." 开头说明路径在根目录之外
  if (rel.startsWith('..') || resolved !== normalizedRoot && !rel) {
    throw new PathTraversalError(normalizedRoot, relativePath);
  }

  return resolved;
}

/**
 * 递归创建目录（如果不存在）
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * 生成卷目录路径：volumes/vXX/
 */
export function volumeDir(projectRoot: string, volume: number): string {
  return resolveSafe(projectRoot, `volumes/v${String(volume).padStart(2, '0')}`);
}

/**
 * 生成章节文件路径：volumes/vXX/chXXX.md
 */
export function chapterPath(projectRoot: string, volume: number, chapterId: number): string {
  const dir = volumeDir(projectRoot, volume);
  return resolve(dir, `ch${String(chapterId).padStart(3, '0')}.md`);
}

/**
 * 生成卷索引文件路径：volumes/vXX/index.json
 */
export function volumeIndexPath(projectRoot: string, volume: number): string {
  const dir = volumeDir(projectRoot, volume);
  return resolve(dir, 'index.json');
}

/**
 * 生成 novel.yaml 路径
 */
export function novelYamlPath(projectRoot: string): string {
  return resolveSafe(projectRoot, 'novel.yaml');
}

/**
 * 生成 workspace/current.json 路径
 */
export function workspaceJsonPath(projectRoot: string): string {
  return resolveSafe(projectRoot, 'workspace/current.json');
}

/**
 * 解析卷号（从目录名 "v01" → 1）
 */
export function parseVolumeNumber(dirName: string): number | null {
  const match = /^v(\d{2,})$/.exec(dirName);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 生成章节版本目录：volumes/vXX/chXXX.versions/
 */
export function chapterVersionsDir(projectRoot: string, volume: number, chapterId: number): string {
  const dir = volumeDir(projectRoot, volume);
  return resolve(dir, `ch${String(chapterId).padStart(3, '0')}.versions`);
}

/**
 * 生成版本文件路径：volumes/vXX/chXXX.versions/vNNN.json
 */
export function versionFilePath(projectRoot: string, volume: number, chapterId: number, versionId: number): string {
  const dir = chapterVersionsDir(projectRoot, volume, chapterId);
  return resolve(dir, `v${String(versionId).padStart(3, '0')}.json`);
}

// ── 知识库路径 ──

/**
 * 生成知识库根目录：knowledge/
 */
export function knowledgeDir(projectRoot: string): string {
  return resolveSafe(projectRoot, 'knowledge');
}

/**
 * 生成知识库单文件路径：knowledge/{category}.json
 * 用于 items / hooks / rules
 */
export function knowledgeFilePath(projectRoot: string, category: string): string {
  return resolveSafe(projectRoot, `knowledge/${category}.json`);
}

/**
 * 生成世界观子文件路径：knowledge/world/{sub}.json
 */
export function worldFilePath(projectRoot: string, subCategory: string): string {
  return resolveSafe(projectRoot, `knowledge/world/${subCategory}.json`);
}

/**
 * 生成自定义分类文件路径：knowledge/custom/{name}.json
 */
export function customFilePath(projectRoot: string, name: string): string {
  return resolveSafe(projectRoot, `knowledge/custom/${name}.json`);
}

/**
 * 生成大纲文件路径：knowledge/outline.json
 */
export function outlineFilePath(projectRoot: string): string {
  return resolveSafe(projectRoot, 'knowledge/outline.json');
}

/**
 * 生成旧版大纲归档路径：knowledge/outline.legacy.json
 * （检测到旧结构 book|volume|chapter / chapterId 时,原 outline.json 改名至此,新模型从空开始）
 */
export function outlineLegacyFilePath(projectRoot: string): string {
  return resolveSafe(projectRoot, 'knowledge/outline.legacy.json');
}

/**
 * 生成关系图文件路径：knowledge/relations.json
 */
export function relationsFilePath(projectRoot: string): string {
  return resolveSafe(projectRoot, 'knowledge/relations.json');
}

/**
 * 生成角色目录：knowledge/characters/
 */
export function characterDir(projectRoot: string): string {
  return resolveSafe(projectRoot, 'knowledge/characters');
}

/**
 * 生成角色索引文件：knowledge/characters/_index.json
 */
export function characterIndexPath(projectRoot: string): string {
  return resolveSafe(projectRoot, 'knowledge/characters/_index.json');
}

/**
 * 生成角色详细档案路径：knowledge/characters/{slug}.json
 */
export function characterFilePath(projectRoot: string, slug: string): string {
  return resolveSafe(projectRoot, `knowledge/characters/${slug}.json`);
}

// ── Memory 路径 ──

/**
 * 生成 memory 根目录：memory/
 */
export function memoryDir(projectRoot: string): string {
  return resolveSafe(projectRoot, 'memory');
}

/**
 * 生成章节摘要目录：memory/summaries/
 */
export function summariesDir(projectRoot: string): string {
  return resolveSafe(projectRoot, 'memory/summaries');
}

/**
 * 生成章节摘要文件路径：memory/summaries/chXXX.json
 */
export function summaryFilePath(projectRoot: string, chapter: number): string {
  return resolveSafe(projectRoot, `memory/summaries/ch${String(chapter).padStart(3, '0')}.json`);
}

/**
 * 生成多章综合总结目录：memory/batch-summaries/
 */
export function batchSummariesDir(projectRoot: string): string {
  return resolveSafe(projectRoot, 'memory/batch-summaries');
}

/**
 * 生成多章综合总结文件路径：memory/batch-summaries/batch-XXX-XXX.json
 */
export function batchSummaryFilePath(projectRoot: string, from: number, to: number): string {
  return resolveSafe(projectRoot, `memory/batch-summaries/batch-${String(from).padStart(3, '0')}-${String(to).padStart(3, '0')}.json`);
}

/**
 * 生成剧情状态快照文件路径：memory/story-state.json
 */
export function storyStateFilePath(projectRoot: string): string {
  return resolveSafe(projectRoot, 'memory/story-state.json');
}

/**
 * 生成角色状态变迁路径:memory/character-states.json
 */
export function characterStatesFilePath(projectRoot: string): string {
  return resolveSafe(projectRoot, 'memory/character-states.json');
}

/**
 * 生成 Curator 实体建议路径:memory/curation-suggestions.json
 */
export function curationSuggestionsFilePath(projectRoot: string): string {
  return resolveSafe(projectRoot, 'memory/curation-suggestions.json');
}

/**
 * 生成操作日志路径:memory/action-log.json
 */
export function actionLogFilePath(projectRoot: string): string {
  return resolveSafe(projectRoot, 'memory/action-log.json');
}

// ── 解析工具 ──

/**
 * 解析章节 ID（从文件名 "ch001.md" → 1）
 */
export function parseChapterId(fileName: string): number | null {
  const match = /^ch(\d{3,})\.md$/.exec(fileName);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 解析版本 ID（从文件名 "v001.json" → 1）
 */
export function parseVersionId(fileName: string): number | null {
  const match = /^v(\d{3,})\.json$/.exec(fileName);
  return match ? parseInt(match[1], 10) : null;
}

// ── 书架(Library)路径 ──

/**
 * 书架根目录:默认 ~/.storyweaver/books,可由 STORYWEAVER_LIBRARY 环境变量覆盖。
 */
export function libraryDir(): string {
  const override = process.env.STORYWEAVER_LIBRARY;
  return override ? resolve(override) : resolve(homedir(), '.storyweaver', 'books');
}

/**
 * 书架根下的"当前书"指针文件:<libraryRoot>/.current-book
 * 内容为当前打开书的 slug。
 */
export function currentBookFilePath(libraryRoot: string): string {
  return resolve(libraryRoot, '.current-book');
}

/**
 * 单本书目录:<libraryRoot>/<slug>
 * slug 必须为纯 ASCII(字母/数字/_/-),否则视为路径遍历并拒绝。
 */
export function bookDir(libraryRoot: string, slug: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    throw new PathTraversalError(libraryRoot, slug);
  }
  return resolve(libraryRoot, slug);
}
