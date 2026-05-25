import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { Workspace } from '../models/index.js';
import { workspaceJsonPath, ensureDir } from './path.js';
import { dirname } from 'node:path';

/**
 * Workspace 存储层 — workspace/current.json 读写
 */
export class WorkspaceStorage {
  private readonly filePath: string;

  constructor(projectRoot: string) {
    this.filePath = workspaceJsonPath(projectRoot);
  }

  /** 读取工作区状态，不存在返回 null */
  async read(): Promise<Workspace | null> {
    if (!existsSync(this.filePath)) {
      return null;
    }
    const raw = await readFile(this.filePath, 'utf-8');
    return JSON.parse(raw) as Workspace;
  }

  /** 写入工作区状态，目录不存在自动创建 */
  async write(workspace: Workspace): Promise<void> {
    await ensureDir(dirname(this.filePath));
    const content = JSON.stringify(workspace, null, 2);
    await writeFile(this.filePath, content, 'utf-8');
  }
}
