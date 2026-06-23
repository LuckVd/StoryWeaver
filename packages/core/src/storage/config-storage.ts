import { readFile, writeFile } from 'node:fs/promises';
import { ensureDir, resolveSafe } from './path.js';
import type { ModelConfig } from '../models/config.js';

const configDir = (projectRoot: string): string => resolveSafe(projectRoot, 'config');
const modelsFilePath = (projectRoot: string): string => resolveSafe(projectRoot, 'config/models.json');

interface ModelsFile {
  models: ModelConfig[];
}

/**
 * 模型配置存储(G05-S02)
 *
 * 管理 config/models.json —— 用户配置的多模型列表。
 * 含 apiKey(本地配置便利);config/models.json 已 gitignore,
 * 对前端只返回脱敏 key(由 service 层处理)。
 */
export class ConfigStorage {
  /** 列出全部模型配置 */
  async listModels(projectRoot: string): Promise<ModelConfig[]> {
    try {
      const data = await readFile(modelsFilePath(projectRoot), 'utf-8');
      return (JSON.parse(data) as ModelsFile).models ?? [];
    } catch {
      return [];
    }
  }

  /** 覆盖保存全部模型配置 */
  async saveModels(projectRoot: string, models: ModelConfig[]): Promise<void> {
    await ensureDir(configDir(projectRoot));
    await writeFile(modelsFilePath(projectRoot), JSON.stringify({ models }, null, 2), 'utf-8');
  }

  /** 新增或更新单个模型(按 id),返回保存后的列表 */
  async upsertModel(projectRoot: string, model: ModelConfig): Promise<ModelConfig[]> {
    const models = await this.listModels(projectRoot);
    const idx = models.findIndex((m) => m.id === model.id);
    if (idx >= 0) models[idx] = model;
    else models.push(model);
    await this.saveModels(projectRoot, models);
    return models;
  }

  /** 删除单个模型,返回保存后的列表 */
  async deleteModel(projectRoot: string, id: string): Promise<ModelConfig[]> {
    const models = (await this.listModels(projectRoot)).filter((m) => m.id !== id);
    await this.saveModels(projectRoot, models);
    return models;
  }
}
