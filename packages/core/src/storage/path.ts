import { resolve, normalize, relative } from 'node:path';
import { mkdir } from 'node:fs/promises';

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
 * 解析章节 ID（从文件名 "ch001.md" → 1）
 */
export function parseChapterId(fileName: string): number | null {
  const match = /^ch(\d{3,})\.md$/.exec(fileName);
  return match ? parseInt(match[1], 10) : null;
}
