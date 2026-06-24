import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import type { ModelConfig, AgentModelConfig, AvailableModel } from '@storyweaver/core';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** 供应商预设(添加模型向导 Step1 卡片 + Step2 表单 + 保存回填都用它) */
type ProviderId = 'glm' | 'deepseek' | 'openai' | 'anthropic' | 'ollama';
interface ProviderPreset {
  id: ProviderId;
  label: string;
  desc: string;
  icon: string;
  baseUrl?: string;
  needKey: boolean;
  needBaseUrl: boolean;
}
const PROVIDERS: ProviderPreset[] = [
  { id: 'glm', label: '智谱 GLM', desc: 'CodePlan,OpenAI 兼容', icon: '⚡', baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4', needKey: true, needBaseUrl: false },
  { id: 'deepseek', label: 'DeepSeek', desc: 'OpenAI 兼容', icon: '🌊', baseUrl: 'https://api.deepseek.com', needKey: true, needBaseUrl: false },
  { id: 'openai', label: '自定义 OpenAI 兼容', desc: '任意兼容端点', icon: '🔌', needKey: true, needBaseUrl: true },
  { id: 'anthropic', label: 'Anthropic', desc: 'Claude', icon: '🅰', baseUrl: 'https://api.anthropic.com', needKey: true, needBaseUrl: false },
  { id: 'ollama', label: 'Ollama', desc: '本地部署', icon: '🦙', baseUrl: 'http://localhost:11434', needKey: false, needBaseUrl: true },
];

interface ModelsResp {
  models: ModelConfig[];
}
interface TestResp {
  ok: boolean;
  message: string;
}

/**
 * 设置页(G05-S02):模型配置管理
 *
 * 添加 / 编辑 / 删除 / 测试模型(openai / anthropic / ollama)。
 * API Key 在后端脱敏展示(***xxxx),编辑时若提交脱敏值则保留旧 key。
 */
export function SettingsPage() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ModelConfig | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, TestResp>>({});
  const [tab, setTab] = useState<'models' | 'prompts'>('models');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get<ModelsResp>('/models');
      setModels(r.models);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(`删除模型 ${id}?`)) return;
    const r = await api.del<ModelsResp>(`/models/${id}`);
    setModels(r.models);
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const r = await api.post<TestResp>(`/models/${id}/test`, {});
      setTestResult((p) => ({ ...p, [id]: r }));
    } catch (e) {
      setTestResult((p) => ({
        ...p,
        [id]: { ok: false, message: e instanceof Error ? e.message : String(e) },
      }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Tab 切换:模型配置 / 提示词(两者关注点不同,分开配置) */}
      <div className="mb-4 flex gap-1 border-b">
        {(['models', 'prompts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'models' ? '模型配置' : '提示词'}
          </button>
        ))}
      </div>

      {tab === 'models' ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">模型配置</h1>
            <button
              onClick={() => setEditing({ id: '', name: '', service: 'openai', apiKey: '' })}
              className="rounded bg-primary px-3 py-1.5 text-primary-foreground"
            >
              + 添加模型
            </button>
          </div>

          {loading ? (
            <div className="text-muted-foreground">加载中…</div>
          ) : models.length === 0 ? (
            <div className="text-muted-foreground">
              暂无模型,点击「添加模型」配置(openai / anthropic / ollama)。
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border p-3">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {m.name}{' '}
                      <span className="text-xs text-muted-foreground">[{m.service}]</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.id} · {m.apiKey || '无 key'} {m.baseUrl ? `· ${m.baseUrl}` : ''}
                    </div>
                    {testResult[m.id] && (
                      <div
                        className={`text-xs ${testResult[m.id].ok ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {testResult[m.id].ok ? '✓' : '✗'} {testResult[m.id].message}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={testing === m.id}
                      onClick={() => handleTest(m.id)}
                      className="rounded border px-2 py-1 text-sm"
                    >
                      {testing === m.id ? '测试中…' : '测试'}
                    </button>
                    <button
                      onClick={() => setEditing(m)}
                      className="rounded border px-2 py-1 text-sm"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="rounded border px-2 py-1 text-sm text-red-600"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <AssignmentSection models={models} />
        </>
      ) : (
        <PromptSection />
      )}

      {editing && (
        <ModelForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ModelForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ModelConfig;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const editing = !!initial.id;
  const [step, setStep] = useState<1 | 2>(editing ? 2 : 1);
  const [provider, setProvider] = useState<ProviderId>((initial.service as ProviderId) ?? 'glm');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? '');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [contextWindow, setContextWindow] = useState<number | ''>(initial.contextWindow ?? '');

  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedModels, setFetchedModels] = useState<AvailableModel[] | null>(null);
  const [modelId, setModelId] = useState(editing ? initial.id : '');
  const [modelName, setModelName] = useState(editing ? initial.name : '');
  const [manualMode, setManualMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const preset = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  const handleFetch = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const r = await api.post<{ models: AvailableModel[]; error?: string }>('/models/available', {
        service: provider,
        apiKey,
        baseUrl: baseUrl || undefined,
      });
      if (!r.models.length) {
        setFetchError(r.error ?? '未返回任何模型');
        setManualMode(true);
      } else {
        setFetchedModels(r.models);
        setManualMode(false);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
      setManualMode(true);
    } finally {
      setFetching(false);
    }
  };

  const canSave = !!modelId && (!preset.needKey || !!apiKey);

  const save = async () => {
    setSaving(true);
    try {
      const masked = initial.apiKey?.startsWith('***') ? initial.apiKey : undefined;
      await api.post('/models', {
        id: modelId,
        name: modelName || modelId,
        service: provider,
        apiKey: apiKey || masked || '',
        baseUrl: baseUrl || undefined,
        contextWindow: contextWindow || undefined,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <Card className="w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="text-lg">{editing ? '编辑模型' : '添加模型'}</CardTitle>
          <CardDescription>
            {step === 1 ? '选择 LLM 供应商' : `配置 ${preset.label} 并选择模型`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProvider(p.id);
                    setBaseUrl(p.baseUrl ?? '');
                    setStep(2);
                  }}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm',
                    provider === p.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border bg-background',
                  )}
                >
                  <span className="text-2xl">{p.icon}</span>
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.desc}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                  ← 重选
                </Button>
                <span className="text-sm text-muted-foreground">
                  {preset.icon} {preset.label}
                </span>
              </div>

              {preset.needKey && (
                <div className="space-y-1.5">
                  <Label>
                    API Key {preset.id !== 'ollama' && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    type="password"
                    placeholder={editing ? '留空则保留原 key' : 'sk-...'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              )}

              {preset.needBaseUrl && (
                <div className="space-y-1.5">
                  <Label>
                    baseUrl {preset.id === 'openai' && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    placeholder={preset.baseUrl ?? 'https://...'}
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={fetching} onClick={handleFetch}>
                    {fetching ? '获取中…' : '🔍 获取可用模型'}
                  </Button>
                  {fetchedModels && !manualMode && (
                    <span className="text-xs text-muted-foreground">✓ 共 {fetchedModels.length} 个</span>
                  )}
                </div>
                {fetchError && (
                  <p className="text-xs text-destructive">
                    {fetchError}{' '}
                    <button type="button" className="underline" onClick={() => setManualMode(true)}>
                      手动输入
                    </button>
                  </p>
                )}
                {fetchedModels && !manualMode && (
                  <div className="space-y-1.5">
                    <Label>模型</Label>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={modelId}
                      onChange={(e) => {
                        const m = fetchedModels.find((x) => x.id === e.target.value);
                        setModelId(e.target.value);
                        setModelName(m?.name ?? e.target.value);
                      }}
                    >
                      <option value="">请选择模型…</option>
                      {fetchedModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {manualMode && (
                  <div className="space-y-1.5">
                    <Label>模型 ID(手动)</Label>
                    <Input
                      placeholder="如 gpt-4o"
                      value={modelId}
                      onChange={(e) => {
                        setModelId(e.target.value);
                        setModelName(e.target.value);
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  {advancedOpen ? '▾' : '▸'} 高级
                </button>
                {advancedOpen && (
                  <div className="mt-2 space-y-3 rounded-lg border bg-muted/30 p-3">
                    {!preset.needBaseUrl && (
                      <div className="space-y-1.5">
                        <Label>baseUrl(覆盖默认)</Label>
                        <Input
                          placeholder={preset.baseUrl ?? 'https://...'}
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>contextWindow(tokens,可选)</Label>
                      <Input
                        type="number"
                        placeholder="如 128000"
                        value={contextWindow}
                        onChange={(e) => setContextWindow(e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          {step === 2 && (
            <Button onClick={save} disabled={saving || !canSave}>
              {saving ? '保存中…' : '保存'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

const AGENTS = ['brainstormer', 'writer', 'auditor', 'summarizer', 'curator'] as const;

/** Agent 中文名称(仅显示用,提交仍用英文 key 对应后端) */
const AGENT_LABELS: Record<string, string> = {
  brainstormer: '构思',
  writer: '写作',
  auditor: '审稿',
  summarizer: '摘要',
  curator: '抽离',
};

/** Agent 模型分配(G05-S03):默认模型 + 各 Agent 单独覆盖 */
function AssignmentSection({ models }: { models: ModelConfig[] }) {
  const [assignment, setAssignment] = useState<AgentModelConfig>({ default: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<AgentModelConfig>('/models/assignment').then(setAssignment);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/models/assignment', assignment);
    } finally {
      setSaving(false);
    }
  };

  const setDefault = (id: string) => setAssignment((a) => ({ ...a, default: id }));
  const setOverride = (agent: string, id: string) =>
    setAssignment((a) => ({
      ...a,
      overrides: { ...(a.overrides ?? {}), [agent]: id },
    }));
  const applyAll = () =>
    setAssignment((a) => {
      const overrides: Record<string, string> = {};
      for (const ag of AGENTS) overrides[ag] = a.default;
      return { ...a, overrides };
    });

  const overrides = assignment.overrides ?? {};

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">各环节模型分配</h2>
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-primary px-3 py-1 text-primary-foreground"
        >
          {saving ? '保存中…' : '保存分配'}
        </button>
      </div>
      <div className="space-y-2 rounded border p-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="w-24">默认模型</span>
          <select
            className="flex-1 rounded border px-2 py-1"
            value={assignment.default}
            onChange={(e) => setDefault(e.target.value)}
          >
            <option value="">(未选)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button onClick={applyAll} className="rounded border px-2 py-1 text-xs">
            应用到全部
          </button>
        </label>
        {AGENTS.map((ag) => (
          <label key={ag} className="flex items-center gap-2 text-sm">
            <span className="w-24">{AGENT_LABELS[ag] ?? ag}</span>
            <select
              className="flex-1 rounded border px-2 py-1"
              value={overrides[ag] ?? ''}
              onChange={(e) => setOverride(ag, e.target.value)}
            >
              <option value="">(用默认)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

interface PromptItem {
  name: string;
  overridden: boolean;
}
interface PromptData {
  content: string;
  overridden: boolean;
  defaultContent: string;
}

/** Prompt 管理(G05-S08):查看 / 编辑 / 恢复默认 */
function PromptSection() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState<PromptData | null>(null);
  const [saving, setSaving] = useState(false);

  const select = async (name: string) => {
    setSelected(name);
    if (!name) {
      setData(null);
      return;
    }
    const d = await api.get<PromptData>(`/prompts/${name}`);
    setData(d);
  };

  useEffect(() => {
    api
      .get<{ prompts: PromptItem[] }>('/prompts')
      .then((r) => {
        setPrompts(r.prompts);
        if (r.prompts[0]) select(r.prompts[0].name);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/prompts/${selected}`, { content: data?.content ?? '' });
      await select(selected);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    await api.del(`/prompts/${selected}`);
    await select(selected);
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Prompt 管理</h2>
        <select
          value={selected}
          onChange={(e) => select(e.target.value)}
          className="rounded border px-2 py-1"
        >
          {prompts.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
              {p.overridden ? ' *' : ''}
            </option>
          ))}
        </select>
        {data?.overridden && (
          <button onClick={reset} className="rounded border px-2 py-1 text-sm">
            恢复默认
          </button>
        )}
      </div>
      {data && (
        <textarea
          className="h-64 w-full rounded border p-2 font-mono text-sm"
          value={data.content}
          onChange={(e) => setData({ ...data, content: e.target.value })}
        />
      )}
      <button
        onClick={save}
        disabled={saving || !data}
        className="mt-2 rounded bg-primary px-3 py-1 text-primary-foreground"
      >
        {saving ? '保存中…' : '保存'}
      </button>
    </div>
  );
}
