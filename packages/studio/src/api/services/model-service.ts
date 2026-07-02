import { ConfigStorage, createLLMClient, type ModelConfig, type AgentModelConfig, type AvailableModel } from '@storyweaver/core';

/**
 * 模型配置服务(G05-S02 / S03)
 *
 * 管理 config/models.json 的多模型 CRUD + Agent 模型分配,并提供连接测试。
 * 对外(前端)返回脱敏 apiKey;upsert 收到脱敏 key 时保留旧 key。
 */
export class ModelService {
  constructor(private readonly configStorage: ConfigStorage) {}

  /** 列出全部模型(脱敏) */
  async list(): Promise<ModelConfig[]> {
    return (await this.configStorage.listModels()).map((m) => this.mask(m));
  }

  private mask(m: ModelConfig): ModelConfig {
    return { ...m, apiKey: m.apiKey ? `***${m.apiKey.slice(-4)}` : '' };
  }

  /** 新增/更新模型(脱敏 key 自动回填旧值) */
  async upsert(model: ModelConfig): Promise<ModelConfig[]> {
    if (model.apiKey.startsWith('***')) {
      const existing = (await this.configStorage.listModels()).find(
        (x) => x.id === model.id,
      );
      if (existing) model = { ...model, apiKey: existing.apiKey };
    }
    model = { ...model, baseUrl: this.normalizeBaseUrl(model.baseUrl) };
    return (await this.configStorage.upsertModel(model)).map((m) => this.mask(m));
  }

  /** 规范化 baseUrl:去掉末尾误填的 /chat/completions 或 /completions(OpenAI SDK 会自动追加) */
  private normalizeBaseUrl(baseUrl?: string): string | undefined {
    if (!baseUrl) return baseUrl;
    const trimmed = baseUrl.trim().replace(/\/(?:chat\/)?completions\/?$/i, '');
    return trimmed || undefined;
  }

  /** 删除模型 */
  async delete(id: string): Promise<ModelConfig[]> {
    return (await this.configStorage.deleteModel(id)).map((m) => this.mask(m));
  }

  /** 测试连接:用该模型发一条简单消息,返回成败与回显 */
  async test(id: string): Promise<{ ok: boolean; message: string }> {
    const models = await this.configStorage.listModels();
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
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        message: /premature close/i.test(msg)
          ? `${msg}（服务端中途断开，常见于推理模型/网关超时，不代表模型不可用）`
          : msg,
      };
    }
  }

  /** 列出某供应商在指定凭证下可用的模型(供前端"添加模型"向导选择) */
  async listAvailable(service: string, apiKey: string, baseUrl?: string): Promise<AvailableModel[]> {
    const config: ModelConfig = {
      id: '__probe__',
      name: '__probe__',
      service,
      apiKey,
      baseUrl: this.normalizeBaseUrl(baseUrl),
    };
    const client = createLLMClient(config);
    if (!client.listModels) {
      throw new Error(`供应商 "${service}" 不支持列出模型`);
    }
    return client.listModels();
  }

  /**
   * 用指定凭证 + modelId 测连接(添加/编辑表单用,无需先保存)。
   * apiKey 缺失或脱敏且提供 id 时,回退存储里的真 key(编辑留空保留原 key 场景)。
   */
  async testConfig(input: {
    id?: string;
    service: string;
    apiKey?: string;
    baseUrl?: string;
    modelId: string;
  }): Promise<{ ok: boolean; message: string }> {
    let apiKey = input.apiKey?.trim();
    if ((!apiKey || apiKey.startsWith('***')) && input.id) {
      const existing = (await this.configStorage.listModels()).find(
        (m) => m.id === input.id,
      );
      apiKey = existing?.apiKey;
    }
    const config: ModelConfig = {
      id: input.modelId,
      name: input.modelId,
      service: input.service,
      apiKey: apiKey ?? '',
      baseUrl: this.normalizeBaseUrl(input.baseUrl),
    };
    try {
      const client = createLLMClient(config);
      const r = await client.chatCompletion(
        [{ role: 'user', content: '请回复"ok"' }],
        { model: input.modelId, maxTokens: 16 },
      );
      return { ok: true, message: `连接成功:${r.content.slice(0, 50)}` };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        message: /premature close/i.test(msg)
          ? `${msg}（服务端中途断开，常见于推理模型/网关超时，不代表模型不可用）`
          : msg,
      };
    }
  }

  // ── Agent 模型分配(G05-S03)──

  /** 读取 Agent 模型分配 */
  async getAssignment(): Promise<AgentModelConfig> {
    return this.configStorage.getAssignment();
  }

  /** 设置 Agent 模型分配 */
  async setAssignment(assignment: AgentModelConfig): Promise<AgentModelConfig> {
    return this.configStorage.setAssignment(assignment);
  }

  /**
   * 解析某 Agent 应使用的模型(override 优先,default 兜底)。
   * 返回未脱敏 ModelConfig,供各 service 初始化 LLM 用。
   */
  async resolveModelForAgent(agent: string): Promise<ModelConfig | null> {
    const [assignment, models] = await Promise.all([
      this.configStorage.getAssignment(),
      this.configStorage.listModels(),
    ]);
    const overrides = assignment.overrides ?? {};
    const id = (overrides as Record<string, string | undefined>)[agent] ?? assignment.default;
    if (!id) return null;
    return models.find((m) => m.id === id) ?? null;
  }
}
