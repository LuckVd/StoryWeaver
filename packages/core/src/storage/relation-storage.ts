import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { relationsFilePath, ensureDir } from './path.js';
import type { RelationEdge } from '../models/index.js';

/**
 * 关系图存储层
 *
 * 所有关系边存储在单个文件：knowledge/relations.json
 */
export class RelationStorage {
  constructor(private readonly projectRoot: string) {}

  /** 列出所有关系边 */
  async list(): Promise<RelationEdge[]> {
    const filePath = relationsFilePath(this.projectRoot);
    if (!existsSync(filePath)) return [];
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as RelationEdge[];
  }

  /** 获取单条关系边 */
  async get(id: string): Promise<RelationEdge | null> {
    const list = await this.list();
    return list.find((e) => e.id === id) ?? null;
  }

  /** 创建关系边 */
  async create(data: Omit<RelationEdge, 'id'>): Promise<RelationEdge> {
    const edge: RelationEdge = { ...data, id: randomUUID() };
    const list = await this.list();
    list.push(edge);
    await this.writeAll(list);
    return edge;
  }

  /** 更新关系边 */
  async update(id: string, patch: Partial<Omit<RelationEdge, 'id'>>): Promise<RelationEdge | null> {
    const list = await this.list();
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated: RelationEdge = { ...list[idx], ...patch };
    list[idx] = updated;
    await this.writeAll(list);
    return updated;
  }

  /** 删除关系边 */
  async delete(id: string): Promise<boolean> {
    const list = await this.list();
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await this.writeAll(list);
    return true;
  }

  private async writeAll(list: RelationEdge[]): Promise<void> {
    const filePath = relationsFilePath(this.projectRoot);
    await ensureDir(resolve(filePath, '..'));
    await writeFile(filePath, JSON.stringify(list, null, 2), 'utf-8');
  }
}
