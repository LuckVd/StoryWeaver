import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import type { ModelConfig } from '@storyweaver/core';

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
  const [form, setForm] = useState<ModelConfig>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ModelConfig, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/models', form);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-96 rounded bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-semibold">{initial.id ? '编辑模型' : '添加模型'}</h2>
        <div className="space-y-2">
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="ID(如 gpt-4o)"
            value={form.id}
            onChange={(e) => set('id', e.target.value)}
            disabled={!!initial.id}
          />
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="显示名称"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <select
            className="w-full rounded border px-2 py-1"
            value={form.service}
            onChange={(e) => set('service', e.target.value)}
          >
            <option value="openai">openai</option>
            <option value="anthropic">anthropic</option>
            <option value="ollama">ollama</option>
          </select>
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="API Key(ollama 可空)"
            value={form.apiKey}
            onChange={(e) => set('apiKey', e.target.value)}
          />
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="baseUrl(可选)"
            value={form.baseUrl ?? ''}
            onChange={(e) => set('baseUrl', e.target.value)}
          />
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="contextWindow(可选)"
            value={form.contextWindow ?? ''}
            onChange={(e) => set('contextWindow', Number(e.target.value) || 0)}
          />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border px-3 py-1">
            取消
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-primary px-3 py-1 text-primary-foreground"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
