import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import {
  ensureDir,
  knowledgeFilePath,
  worldFilePath,
  customFilePath,
  characterIndexPath,
  characterFilePath,
} from './path.js';
import type {
  Character,
  WorldEntry,
  WorldSubCategory,
  Item,
  Hook,
  Rule,
  CustomKnowledge,
} from '../models/index.js';

// ── 通用工具 ──

/** 单文件数组分类 */
type SimpleCategory = 'items' | 'hooks' | 'rules';

/** 读取 JSON 文件，不存在返回 null */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) return null;
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

/** 写入 JSON 文件（自动创建目录） */
async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDir(resolve(filePath, '..'));
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** 生成 ID + 时间戳 */
function newMeta() {
  const now = new Date().toISOString();
  return { id: randomUUID(), createdAt: now, updatedAt: now };
}

// ── KnowledgeStorage ──

/**
 * 知识库存储层
 *
 * 管理 6 种分类的 CRUD：
 * - characters: 目录结构（_index.json + {slug}.json）
 * - world: 子目录（world/{sub}.json）
 * - items / hooks / rules: 单文件数组
 * - custom: 子目录（custom/{name}.json）
 */
export class KnowledgeStorage {
  constructor(private readonly projectRoot: string) {}

  // ── Characters（目录结构） ──

  /** 列出所有角色（索引信息） */
  async listCharacters(): Promise<Character[]> {
    const indexPath = characterIndexPath(this.projectRoot);
    const list = await readJsonFile<Character[]>(indexPath);
    return list ?? [];
  }

  /** 获取单个角色详细档案 */
  async getCharacter(id: string): Promise<Character | null> {
    const list = await this.listCharacters();
    const item = list.find((c) => c.id === id);
    if (!item) return null;
    // 尝试读取详细档案
    const slug = slugify(item.name);
    const detailPath = characterFilePath(this.projectRoot, slug);
    const detail = await readJsonFile<Character>(detailPath);
    return detail ?? item;
  }

  /** 创建角色 */
  async createCharacter(data: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<Character> {
    const item: Character = { ...data, ...newMeta() };
    const list = await this.listCharacters();
    list.push(item);
    await writeJsonFile(characterIndexPath(this.projectRoot), list);
    // 写详细档案
    const slug = slugify(item.name);
    await writeJsonFile(characterFilePath(this.projectRoot, slug), item);
    return item;
  }

  /** 更新角色 */
  async updateCharacter(id: string, patch: Partial<Omit<Character, 'id' | 'createdAt'>>): Promise<Character | null> {
    const list = await this.listCharacters();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const updated: Character = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
    list[idx] = updated;
    await writeJsonFile(characterIndexPath(this.projectRoot), list);
    // 更新详细档案
    const slug = slugify(updated.name);
    await writeJsonFile(characterFilePath(this.projectRoot, slug), updated);
    return updated;
  }

  /** 删除角色 */
  async deleteCharacter(id: string): Promise<boolean> {
    const list = await this.listCharacters();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return false;

    const item = list[idx];
    list.splice(idx, 1);
    await writeJsonFile(characterIndexPath(this.projectRoot), list);
    // 删除详细档案
    const slug = slugify(item.name);
    const detailPath = characterFilePath(this.projectRoot, slug);
    if (existsSync(detailPath)) {
      await unlink(detailPath);
    }
    return true;
  }

  // ── World（子分类文件） ──

  async listWorld(subCategory: WorldSubCategory): Promise<WorldEntry[]> {
    const filePath = worldFilePath(this.projectRoot, subCategory);
    const list = await readJsonFile<WorldEntry[]>(filePath);
    return list ?? [];
  }

  async getWorld(subCategory: WorldSubCategory, id: string): Promise<WorldEntry | null> {
    const list = await this.listWorld(subCategory);
    return list.find((e) => e.id === id) ?? null;
  }

  async createWorld(subCategory: WorldSubCategory, data: Omit<WorldEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorldEntry> {
    const item: WorldEntry = { ...data, ...newMeta() };
    const list = await this.listWorld(subCategory);
    list.push(item);
    await writeJsonFile(worldFilePath(this.projectRoot, subCategory), list);
    return item;
  }

  async updateWorld(subCategory: WorldSubCategory, id: string, patch: Partial<Omit<WorldEntry, 'id' | 'createdAt'>>): Promise<WorldEntry | null> {
    const list = await this.listWorld(subCategory);
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated: WorldEntry = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
    list[idx] = updated;
    await writeJsonFile(worldFilePath(this.projectRoot, subCategory), list);
    return updated;
  }

  async deleteWorld(subCategory: WorldSubCategory, id: string): Promise<boolean> {
    const list = await this.listWorld(subCategory);
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await writeJsonFile(worldFilePath(this.projectRoot, subCategory), list);
    return true;
  }

  // ── Simple categories（items / hooks / rules） ──

  async listSimple<T extends { id: string }>(category: SimpleCategory): Promise<T[]> {
    const filePath = knowledgeFilePath(this.projectRoot, category);
    const list = await readJsonFile<T[]>(filePath);
    return list ?? [];
  }

  async getSimple<T extends { id: string }>(category: SimpleCategory, id: string): Promise<T | null> {
    const list = await this.listSimple<T>(category);
    return list.find((e) => e.id === id) ?? null;
  }

  async createSimple<T extends { id: string; createdAt: string; updatedAt: string }>(category: SimpleCategory, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const item = { ...data, ...newMeta() } as T;
    const list = await this.listSimple<T>(category);
    list.push(item);
    await writeJsonFile(knowledgeFilePath(this.projectRoot, category), list);
    return item;
  }

  async updateSimple<T extends { id: string }>(category: SimpleCategory, id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | null> {
    const list = await this.listSimple<T>(category);
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated = { ...list[idx], ...patch, updatedAt: new Date().toISOString() } as T;
    list[idx] = updated;
    await writeJsonFile(knowledgeFilePath(this.projectRoot, category), list);
    return updated;
  }

  async deleteSimple(category: SimpleCategory, id: string): Promise<boolean> {
    const list = await this.listSimple<{ id: string }>(category);
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await writeJsonFile(knowledgeFilePath(this.projectRoot, category), list);
    return true;
  }

  // ── Custom（自定义分类目录） ──

  async listCustom(categoryName: string): Promise<CustomKnowledge[]> {
    const filePath = customFilePath(this.projectRoot, categoryName);
    const list = await readJsonFile<CustomKnowledge[]>(filePath);
    return list ?? [];
  }

  async getCustom(categoryName: string, id: string): Promise<CustomKnowledge | null> {
    const list = await this.listCustom(categoryName);
    return list.find((e) => e.id === id) ?? null;
  }

  async createCustom(categoryName: string, data: Omit<CustomKnowledge, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomKnowledge> {
    const item: CustomKnowledge = { ...data, ...newMeta() };
    const list = await this.listCustom(categoryName);
    list.push(item);
    await writeJsonFile(customFilePath(this.projectRoot, categoryName), list);
    return item;
  }

  async updateCustom(categoryName: string, id: string, patch: Partial<Omit<CustomKnowledge, 'id' | 'createdAt'>>): Promise<CustomKnowledge | null> {
    const list = await this.listCustom(categoryName);
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated: CustomKnowledge = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
    list[idx] = updated;
    await writeJsonFile(customFilePath(this.projectRoot, categoryName), list);
    return updated;
  }

  async deleteCustom(categoryName: string, id: string): Promise<boolean> {
    const list = await this.listCustom(categoryName);
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    await writeJsonFile(customFilePath(this.projectRoot, categoryName), list);
    return true;
  }

  // ── 概览 ──

  /** 列出所有自定义分类名称 */
  async listCustomCategories(): Promise<string[]> {
    const dir = resolve(this.projectRoot, 'knowledge', 'custom');
    if (!existsSync(dir)) return [];
    const entries = await readdir(dir);
    return entries.filter((e) => e.endsWith('.json')).map((e) => e.replace(/\.json$/, '')).sort();
  }

  /** 确保自定义分类存在（写入空数组文件，使 listCustomCategories 能扫到）；已存在则无操作 */
  async ensureCustomCategory(categoryName: string): Promise<void> {
    const filePath = customFilePath(this.projectRoot, categoryName);
    if (existsSync(filePath)) return;
    await writeJsonFile(filePath, []);
  }
}

/** 将角色名转为文件名 slug */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
    || 'unnamed';
}
