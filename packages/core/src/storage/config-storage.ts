import { readFile, writeFile } from 'node:fs/promises';
import { ensureDir, resolveSafe } from './path.js';
import type { ModelConfig, AgentModelConfig } from '../models/config.js';

const configDir = (projectRoot: string): string => resolveSafe(projectRoot, 'config');
const modelsFilePath = (projectRoot: string): string => resolveSafe(projectRoot, 'config/models.json');

interface ModelsFile {
  models: ModelConfig[];
  /** Agent 模型分配(G05-S03) */
  assignment?: AgentModelConfig;
}

/**
 * 模型配置存储(G05-S02 / S03)
 *
 * 管理 config/models.json —— 多模型列表 + Agent 模型分配。
 * 含 apiKey;config/models.json 已 gitignore,前端只看脱敏 key。
 */
export class ConfigStorage {
  private async readRaw(projectRoot: string): Promise<ModelsFile> {
    try {
      const data = await readFile(modelsFilePath(projectRoot), 'utf-8');
      return JSON.parse(data) as ModelsFile;
    } catch {
      return { models: [] };
    }
  }

  private async writeRaw(projectRoot: string, file: ModelsFile): Promise<void> {
    await ensureDir(configDir(projectRoot));
    await writeFile(modelsFilePath(projectRoot), JSON.stringify(file, null, 2), 'utf-8');
  }

  /** 列出全部模型配置 */
  async listModels(projectRoot: string): Promise<ModelConfig[]> {
    return (await this.readRaw(projectRoot)).models ?? [];
  }

  /** 覆盖保存全部模型配置(保留 assignment) */
  async saveModels(projectRoot: string, models: ModelConfig[]): Promise<void> {
    const raw = await this.readRaw(projectRoot);
    await this.writeRaw(projectRoot, { models, assignment: raw.assignment });
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

  // ── Agent 模型分配(G05-S03)──

  /** 读取 Agent 模型分配(默认 { default: '' }) */
  async getAssignment(projectRoot: string): Promise<AgentModelConfig> {
    return (await this.readRaw(projectRoot)).assignment ?? { default: '' };
  }

  /** 设置 Agent 模型分配 */
  async setAssignment(projectRoot: string, assignment: AgentModelConfig): Promise<AgentModelConfig> {
    const raw = await this.readRaw(projectRoot);
    await this.writeRaw(projectRoot, { models: raw.models, assignment });
    return assignment;
  }
}
