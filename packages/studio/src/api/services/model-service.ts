import { ConfigStorage, createLLMClient, type ModelConfig } from '@storyweaver/core';

/**
 * 模型配置服务(G05-S02)
 *
 * 管理 config/models.json 的多模型 CRUD,并提供连接测试。
 * 对外(前端)返回脱敏 apiKey;upsert 时若收到脱敏 key(***xxxx)则保留旧 key。
 */
export class ModelService {
  constructor(
    private readonly configStorage: ConfigStorage,
    private readonly projectRoot: string,
  ) {}

  /** 列出全部模型(脱敏) */
  async list(): Promise<ModelConfig[]> {
    return (await this.configStorage.listModels(this.projectRoot)).map((m) => this.mask(m));
  }

  private mask(m: ModelConfig): ModelConfig {
    return { ...m, apiKey: m.apiKey ? `***${m.apiKey.slice(-4)}` : '' };
  }

  /** 新增/更新模型(脱敏 key 自动回填旧值) */
  async upsert(model: ModelConfig): Promise<ModelConfig[]> {
    if (model.apiKey.startsWith('***')) {
      const existing = (await this.configStorage.listModels(this.projectRoot)).find(
        (x) => x.id === model.id,
      );
      if (existing) model = { ...model, apiKey: existing.apiKey };
    }
    return (await this.configStorage.upsertModel(this.projectRoot, model)).map((m) => this.mask(m));
  }

  /** 删除模型 */
  async delete(id: string): Promise<ModelConfig[]> {
    return (await this.configStorage.deleteModel(this.projectRoot, id)).map((m) => this.mask(m));
  }

  /** 测试连接:用该模型发一条简单消息,返回成败与回显 */
  async test(id: string): Promise<{ ok: boolean; message: string }> {
    const models = await this.configStorage.listModels(this.projectRoot);
    const model = models.find((m) => m.id === id);
    if (!model) return { ok: false, message: '模型不存在' };
    try {
      const client = createLLMClient(model);
      const r = await client.chatCompletion(
        [{ role: 'user', content: '请回复"ok"' }],
        { model: model.id, maxTokens: 16 },
      );
      return { ok: true, message: `连接成功:${r.content.slice(0, 50)}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
}
