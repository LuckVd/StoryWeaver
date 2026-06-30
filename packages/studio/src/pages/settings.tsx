import { useEffect, useState, type ComponentType } from 'react';
import { api } from '../lib/api-client';
import type { ModelConfig, AgentModelConfig, AvailableModel } from '@storyweaver/core';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Seal } from '@/components/ui/seal';
import { Plus, Lightbulb, Pen, FileCheck, FileText, Microscope } from 'lucide-react';
import { Zhipu, DeepSeek, OpenAI, Anthropic, Ollama } from '@lobehub/icons';

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

/** 供应商品牌图标(@lobehub/icons 官方 logo,优先 Color 品牌色变体,无则 Mono) */
const brandIcon = (mod: ComponentType<{ size?: number }>) => {
  const color = (mod as unknown as { Color?: ComponentType<{ size?: number }> }).Color;
  return color ?? mod;
};
const PROVIDER_ICON: Record<ProviderId, ComponentType<{ size?: number }>> = {
  glm: brandIcon(Zhipu),
  deepseek: brandIcon(DeepSeek),
  openai: brandIcon(OpenAI),
  anthropic: brandIcon(Anthropic),
  ollama: brandIcon(Ollama),
};

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
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    window.storyweaver?.getZoom().then(setZoom);
  }, []);
  const changeZoom = async (v: number) => {
    setZoom(v);
    await window.storyweaver?.setZoom(v);
  };

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
    <div className="mx-auto w-full max-w-[1600px] px-6 py-6 sm:px-10 lg:px-16 lg:py-8 xl:px-24">
      {/* 界面缩放(4K/高分辨率屏调节,持久化到 userData) */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">界面缩放</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            className="flex-1 accent-vermilion"
          />
          <span className="w-14 shrink-0 text-right font-heading text-sm tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
        </CardContent>
      </Card>

      {/* Tab 切换:模型配置 / 提示词(两者关注点不同,分开配置) */}
      <div className="mb-4 flex gap-1 border-b">
        {(['models', 'prompts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 font-heading text-sm font-medium transition-colors ${
              tab === t
                ? 'border-vermilion text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'models' ? '模型配置' : '提示词'}
          </button>
        ))}
      </div>

      {tab === 'models' ? (
        <>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h1 className="font-heading text-xl font-semibold">模型配置</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">管理可用模型 · 测试连接 · 分配给各环节</p>
            </div>
            <Button onClick={() => setEditing({ id: '', name: '', service: 'openai', apiKey: '' })}>
              <Plus className="mr-1 h-4 w-4" /> 添加模型
            </Button>
          </div>

          {loading ? (
            <div className="text-muted-foreground">加载中…</div>
          ) : models.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              暂无模型。点击「添加模型」配置 GLM / DeepSeek / OpenAI 兼容 / Anthropic / Ollama。
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {models.map((m) => {
                const provider = PROVIDERS.find((p) => p.id === m.service);
                const ProviderIcon = PROVIDER_ICON[m.service as ProviderId] ?? OpenAI;
                return (
                  <div key={m.id} className="flex flex-col rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <ProviderIcon size={20} />
                      <span className="truncate font-heading font-medium">{m.name}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{provider?.label ?? m.service}</div>
                    <div className="mt-2 truncate font-mono text-xs text-muted-foreground">
                      {m.id} · {m.apiKey || '无 key'}{m.baseUrl ? ` · ${m.baseUrl}` : ''}
                    </div>
                    {testResult[m.id] && (
                      <div
                        className={cn(
                          'mt-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs',
                          testResult[m.id].ok
                            ? 'bg-green-600/10 text-green-600'
                            : 'bg-destructive/10 text-destructive',
                        )}
                      >
                        {testResult[m.id].ok ? '✓' : '✗'} {testResult[m.id].message}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-1 border-t pt-3">
                      <Button variant="outline" size="sm" className="flex-1" disabled={testing === m.id} onClick={() => handleTest(m.id)}>
                        {testing === m.id ? '测试中…' : '测试'}
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(m)}>
                        编辑
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(m.id)}>
                        删除
                      </Button>
                    </div>
                  </div>
                );
              })}
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
  const [manualMode, setManualMode] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState<TestResp | null>(null);

  const preset = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const PresetIcon = PROVIDER_ICON[preset.id];

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

  // 编辑时 key 可留空(后端脱敏回填旧 key),故 editing 放行 needKey 校验
  const canSave = !!modelId && (!preset.needKey || !!apiKey || editing);

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

  const handleTestConnect = async () => {
    if (!modelId) return;
    setTesting(true);
    setTestRes(null);
    try {
      const r = await api.post<TestResp>('/models/test-config', {
        id: editing ? initial.id : undefined,
        service: provider,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        modelId,
      });
      setTestRes(r);
    } catch (e) {
      setTestRes({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
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
            <div className="grid grid-cols-2 gap-3">
              {PROVIDERS.map((p) => {
                const PIcon = PROVIDER_ICON[p.id];
                return (
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
                    {PIcon && <PIcon size={28} />}
                    <span className="font-medium">{p.label}</span>
                    <span className="text-xs text-muted-foreground">{p.desc}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                  ← 重选
                </Button>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {PresetIcon && <PresetIcon size={16} />}
                  {preset.label}
                </span>
              </div>

              {preset.needKey && (
                <div className="space-y-1.5">
                  <Label>
                    API Key {preset.id !== 'ollama' && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    type="password"
                    placeholder={editing && initial.apiKey ? `留空保留原 key（${initial.apiKey}）` : 'sk-...'}
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
                    placeholder={preset.baseUrl ?? 'https://your-host/v1'}
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                  {preset.id === 'openai' && (
                    <p className="text-xs text-muted-foreground">
                      填到 <code className="rounded bg-muted px-1">/v1</code> 为止即可,无需
                      <code className="rounded bg-muted px-1">/chat/completions</code>(SDK 自动追加;误填会被自动去除)
                    </p>
                  )}
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

              {/* 测试连接(用当前表单值,无需先保存) */}
              <div className="space-y-1.5">
                <Button variant="outline" size="sm" disabled={testing || !modelId} onClick={handleTestConnect}>
                  {testing ? '测试中…' : '⚡ 测试连接'}
                </Button>
                {testRes && (
                  <p className={cn('text-xs', testRes.ok ? 'text-green-600' : 'text-destructive')}>
                    {testRes.ok ? '✓' : '✗'} {testRes.message}
                  </p>
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

/** Agent 环节图标(lucide) */
const AGENT_ICON: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  brainstormer: Lightbulb,
  writer: Pen,
  auditor: FileCheck,
  summarizer: FileText,
  curator: Microscope,
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
    <div className="mt-8">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">各环节模型分配</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">默认模型 + 单独覆盖某个环节</p>
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? '保存中…' : '保存分配'}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b pb-3">
        <span className="w-16 shrink-0 font-heading text-sm">默认</span>
        <select
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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
        <Button variant="outline" size="xs" onClick={applyAll}>
          应用到全部
        </Button>
      </div>
      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {AGENTS.map((ag) => {
          const AgentIcon = AGENT_ICON[ag] ?? Lightbulb;
          return (
            <label key={ag} className="flex items-center gap-2">
              <AgentIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="w-10 shrink-0 font-heading text-sm">{AGENT_LABELS[ag] ?? ag}</span>
              <select
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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
          );
        })}
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
    <div className="flex h-[calc(100vh-8rem)] min-h-[24rem] gap-4">
      {/* 左:提示词列表(替代下拉框,中文名 + 覆盖标记) */}
      <div className="flex w-56 shrink-0 flex-col overflow-hidden rounded-lg border bg-sidebar/40">
        <div className="border-b border-sidebar-border px-3 py-2">
          <span className="font-heading text-sm font-semibold">提示词</span>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {prompts.map((p) => {
            const active = p.name === selected;
            return (
              <button
                key={p.name}
                onClick={() => select(p.name)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left font-heading text-sm transition-colors',
                  active
                    ? 'bookmark-bar bg-sidebar-accent/60 font-medium'
                    : 'text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground',
                )}
              >
                <span>{AGENT_LABELS[p.name] ?? p.name}</span>
                {p.overridden && (
                  <Seal className="h-4 w-4 shrink-0 text-[0.5rem] [transform:none]">朱</Seal>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 右:编辑区 */}
      <div className="flex flex-1 flex-col">
        {data ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold">
                  {AGENT_LABELS[selected] ?? selected}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {data.overridden ? '已自定义 · 保存后生效' : '默认提示词'}
                </p>
              </div>
              {data.overridden && (
                <Button variant="outline" size="sm" onClick={reset}>
                  恢复默认
                </Button>
              )}
            </div>
            <textarea
              className="w-full flex-1 resize-none rounded-lg border bg-background p-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
              value={data.content}
              onChange={(e) => setData({ ...data, content: e.target.value })}
            />
            <div className="mt-2 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            从左侧选择一个提示词
          </div>
        )}
      </div>
    </div>
  );
}
