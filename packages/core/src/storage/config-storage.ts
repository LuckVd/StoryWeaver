import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ensureDir, globalConfigDir } from './path.js';
import type { ModelConfig, AgentModelConfig } from '../models/config.js';

interface ModelsFile {
  models: ModelConfig[];
  /** Agent 模型分配(G05-S03) */
  assignment?: AgentModelConfig;
}

/**
 * 模型配置存储(G05-S02 / S03)
 *
 * 管理 config/models.json —— 多模型列表 + Agent 模型分配。
 * **全局化**:配置存于全局配置目录(默认 ~/.storyweaver/config,跨书共享),
 * 与"当前打开哪本书"无关——无书架/空书架时也可读写模型。
 * 含 apiKey;models.json 已 gitignore,前端只看脱敏 key。
 * 测试可通过构造函数注入 configRoot 实现隔离。
 */
export class ConfigStorage {
  private readonly configRoot: string;

  /** @param configRoot 配置根目录;缺省为全局 globalConfigDir()(~/.storyweaver/config) */
  constructor(configRoot?: string) {
    this.configRoot = configRoot ?? globalConfigDir();
  }

  private modelsFilePath(): string {
    return resolve(this.configRoot, 'models.json');
  }

  private async readRaw(): Promise<ModelsFile> {
    try {
      const data = await readFile(this.modelsFilePath(), 'utf-8');
      return JSON.parse(data) as ModelsFile;
    } catch {
      return { models: [] };
    }
  }

  private async writeRaw(file: ModelsFile): Promise<void> {
    await ensureDir(this.configRoot);
    await writeFile(this.modelsFilePath(), JSON.stringify(file, null, 2), 'utf-8');
  }

  /** 列出全部模型配置 */
  async listModels(): Promise<ModelConfig[]> {
    return (await this.readRaw()).models ?? [];
  }

  /** 覆盖保存全部模型配置(保留 assignment) */
  async saveModels(models: ModelConfig[]): Promise<void> {
    const raw = await this.readRaw();
    await this.writeRaw({ models, assignment: raw.assignment });
  }

  /** 新增或更新单个模型(按 id),返回保存后的列表 */
  async upsertModel(model: ModelConfig): Promise<ModelConfig[]> {
    const models = await this.listModels();
    const idx = models.findIndex((m) => m.id === model.id);
    if (idx >= 0) models[idx] = model;
    else models.push(model);
    await this.saveModels(models);
    return models;
  }

  /** 删除单个模型,返回保存后的列表 */
  async deleteModel(id: string): Promise<ModelConfig[]> {
    const models = (await this.listModels()).filter((m) => m.id !== id);
    await this.saveModels(models);
    return models;
  }

  // ── Agent 模型分配(G05-S03)──

  /** 读取 Agent 模型分配(默认 { default: '' }) */
  async getAssignment(): Promise<AgentModelConfig> {
    return (await this.readRaw()).assignment ?? { default: '' };
  }

  /** 设置 Agent 模型分配 */
  async setAssignment(assignment: AgentModelConfig): Promise<AgentModelConfig> {
    const raw = await this.readRaw();
    await this.writeRaw({ models: raw.models, assignment });
    return assignment;
  }
}
