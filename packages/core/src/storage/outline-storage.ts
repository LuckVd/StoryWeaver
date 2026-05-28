import { existsSync } from 'node:fs';
import { outlineFilePath } from './path.js';
import { ensureDir } from './path.js';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { OutlineNode } from '../models/index.js';

/**
 * 大纲存储层
 *
 * 整棵大纲树作为一个 JSON 文件读写：knowledge/outline.json
 */
export class OutlineStorage {
  constructor(private readonly projectRoot: string) {}

  /** 读取大纲树，不存在返回 null */
  async read(): Promise<OutlineNode | null> {
    const filePath = outlineFilePath(this.projectRoot);
    if (!existsSync(filePath)) return null;
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as OutlineNode;
  }

  /** 写入大纲树（自动创建目录） */
  async write(tree: OutlineNode): Promise<void> {
    const filePath = outlineFilePath(this.projectRoot);
    await ensureDir(resolve(filePath, '..'));
    await writeFile(filePath, JSON.stringify(tree, null, 2), 'utf-8');
  }

  /** 大纲是否存在 */
  exists(): boolean {
    return existsSync(outlineFilePath(this.projectRoot));
  }
}
