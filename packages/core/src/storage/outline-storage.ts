import { existsSync } from 'node:fs';
import { outlineFilePath, outlineLegacyFilePath } from './path.js';
import { ensureDir } from './path.js';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { OutlineNode } from '../models/index.js';

/**
 * 大纲存储层
 *
 * 整棵大纲树作为一个 JSON 文件读写：knowledge/outline.json
 */
export class OutlineStorage {
  constructor(private readonly projectRoot: string) {}

  /** 读取大纲树，不存在返回 null。读到旧版结构自动归档并返回 null(重新规划)。 */
  async read(): Promise<OutlineNode | null> {
    const filePath = outlineFilePath(this.projectRoot);
    if (!existsSync(filePath)) return null;
    const raw = await readFile(filePath, 'utf-8');
    const tree = JSON.parse(raw) as OutlineNode;
    if (isLegacyOutline(tree)) {
      // 旧结构(book|volume|chapter / chapterId)→ 归档,新模型(卷+大事件)从空开始
      await rename(filePath, outlineLegacyFilePath(this.projectRoot));
      console.log(
        '[outline] 检测到旧版大纲,已归档为 outline.legacy.json,请在应用内按"卷+大事件"重新规划',
      );
      return null;
    }
    return tree;
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

/**
 * 判定是否旧版大纲结构:任一节点 type 为 volume/chapter,或含 chapterId 字段。
 * (运行时旧 JSON 仍带这些字段,故用 any 走读,不依赖新类型)
 */
function isLegacyOutline(root: OutlineNode): boolean {
  let legacy = false;
  const walk = (n: any): void => {
    if (n.type === 'volume' || n.type === 'chapter' || typeof n.chapterId === 'number') {
      legacy = true;
    }
    (n.children ?? []).forEach(walk);
  };
  walk(root);
  return legacy;
}

