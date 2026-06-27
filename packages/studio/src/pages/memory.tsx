import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Seal } from '@/components/ui/seal';
import type { CharacterStates, CurationSuggestions, HookTracking, ActionLog } from '@storyweaver/core';
import { useChapterStore } from '@/stores/chapter-store';

/**
 * AI 记忆库页面（G03-S08）
 *
 * 展示发布流程自动维护的派生记忆：时间线 + 角色状态变迁。
 * 数据由 GET /memory/timeline 与 /memory/character-states 提供。
 */
export function MemoryPage() {
  const [tab, setTab] = useState<'hooks' | 'characters' | 'curator' | 'log'>('hooks');
  const [hooks, setHooks] = useState<HookTracking[]>([]);
  const [characters, setCharacters] = useState<CharacterStates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchVolumesAndChapters = useChapterStore((s) => s.fetchVolumesAndChapters);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<HookTracking[]>('/memory/hooks-tracking'),
      api.get<CharacterStates | null>('/memory/character-states'),
    ])
      .then(([h, c]) => {
        setHooks(h);
        setCharacters(c);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchVolumesAndChapters();
    load();
  }, []);

  if (loading) return <div className="p-6 text-muted-foreground">加载中...</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI 记忆库</h1>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1 h-4 w-4" /> 刷新
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-4 flex gap-2 border-b">
        {(['hooks', 'characters', 'curator', 'log'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 font-heading text-sm transition-colors ${
              tab === t
                ? 'border-vermilion font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'hooks' ? '伏笔追踪' : t === 'characters' ? '角色状态' : t === 'curator' ? '实体建议' : '操作记录'}
          </button>
        ))}
      </div>

      {tab === 'hooks' ? (
        <HooksTrackingView hooks={hooks} reload={load} />
      ) : tab === 'characters' ? (
        <CharactersView states={characters} />
      ) : tab === 'curator' ? (
        <CuratorView />
      ) : (
        <ActionLogView />
      )}
    </div>
  );
}

function HooksTrackingView({ hooks, reload }: { hooks: HookTracking[]; reload: () => void }) {
  const chapterOrder = useChapterStore((s) => s.chapterOrder);
  const [busy, setBusy] = useState<string | null>(null);
  if (!hooks || hooks.length === 0)
    return (
      <div className="text-muted-foreground">
        暂无伏笔。在知识库添加伏笔、并发布推进它的章节后，这里会显示追踪轨迹。
      </div>
    );

  const handleAction = async (name: string, action: 'resolve' | 'reactivate') => {
    const key = `${name}:${action}`;
    setBusy(key);
    try {
      await api.post(`/memory/hooks/${encodeURIComponent(name)}/action`, { action });
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {hooks.map((h) => {
        const action = h.status === 'active' ? 'resolve' : 'reactivate';
        const key = `${h.name}:${action}`;
        return (
          <div key={h.name} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-medium">
                {h.name}
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                    h.status === 'active' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {h.status === 'active' ? '进行中' : '已回收'}
                </span>
              </h3>
              <Button size="xs" disabled={busy === key} onClick={() => handleAction(h.name, action)}>
                {busy === key ? '处理中…' : h.status === 'active' ? '标记完成' : '重新激活'}
              </Button>
            </div>
            <p className="mb-2 text-sm text-muted-foreground">{h.description}</p>
            <div className="text-xs text-muted-foreground">
              埋于第 {chapterOrder[h.plantedAt] ?? h.plantedAt} 章 · 最近推进第{' '}
              {chapterOrder[h.lastMention] ?? h.lastMention} 章
            </div>
            {h.mentions.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  推进轨迹（{h.mentions.length}）
                </summary>
                <ul className="ml-4 mt-1 list-disc">
                  {h.mentions.map((m, i) => (
                    <li key={i}>
                      第{chapterOrder[m.chapter] ?? m.chapter}章 · {m.type === 'planted' ? '埋设' : '推进'}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CharactersView({ states }: { states: CharacterStates | null }) {
  const chapterOrder = useChapterStore((s) => s.chapterOrder);
  if (!states || states.characters.length === 0)
    return (
      <div className="text-muted-foreground">暂无角色状态数据。发布含有状态变迁的章节后会自动生成。</div>
    );
  return (
    <div className="space-y-3">
      {states.characters.map((c) => (
        <div key={c.entity} className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-2 font-medium">{c.entity}</h3>
          <div className="mb-2 flex flex-wrap gap-x-4 text-sm">
            {Object.entries(c.currentState).map(([k, v]) => (
              <span key={k}>
                <span className="text-muted-foreground">{k}：</span>
                {v}
              </span>
            ))}
          </div>
          {c.history.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">变迁历史（{c.history.length}）</summary>
              <ul className="ml-4 mt-1 list-disc">
                {c.history.map((h, i) => (
                  <li key={i}>
                    第{chapterOrder[h.chapter] ?? h.chapter}章 · {h.field}：{h.from} → {h.to}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

function CuratorView() {
  const [data, setData] = useState<CurationSuggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .get<CurationSuggestions | null>('/memory/curation')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (
    chapter: number,
    type: 'characters' | 'hooks' | 'worldEntries',
    name: string,
  ) => {
    const key = `${chapter}:${type}:${name}`;
    setBusy(key);
    setError(null);
    try {
      await api.post('/memory/curation/accept', { chapter, type, name });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入失败');
    } finally {
      setBusy(null);
    }
  };

  const handleDismiss = async (
    chapter: number,
    type: 'characters' | 'hooks' | 'worldEntries',
    name: string,
  ) => {
    const key = `${chapter}:${type}:${name}:dismiss`;
    setBusy(key);
    setError(null);
    try {
      await api.post('/memory/curation/dismiss', { chapter, type, name });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '放弃失败');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="text-muted-foreground">加载中...</div>;
  if (!data || data.suggestions.length === 0)
    return (
      <div className="text-muted-foreground">
        暂无实体建议。发布章节后 AI 自动提取，或对已发布章节触发提取后在此确认入库。
      </div>
    );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      )}
      {data.suggestions.map((s) => {
        const items: Array<{
          type: 'characters' | 'hooks' | 'worldEntries';
          name: string;
          desc: string;
          payload: Record<string, unknown>;
        }> = [
          ...s.characters.map((c) => ({
            type: 'characters' as const,
            name: c.name,
            desc: c.description,
            payload: { name: c.name, description: c.description },
          })),
          ...s.hooks.map((h) => ({
            type: 'hooks' as const,
            name: h.name,
            desc: h.description,
            payload: { name: h.name, description: h.description },
          })),
          ...s.worldEntries.map((w) => ({
            type: 'worldEntries' as const,
            name: w.name,
            desc: w.content,
            payload: { name: w.name, category: w.category, content: w.content },
          })),
        ];
        return (
          <div key={s.chapter} className="rounded-lg border border-l-2 border-l-vermilion/40 bg-card p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-1.5 font-heading font-medium">
              <Seal className="h-4 w-4 text-[0.5rem] [transform:none]">朱</Seal>
              第 {s.chapter} 章建议
            </h3>
            <div className="space-y-2">
              {items.map((it) => {
                const key = `${s.chapter}:${it.type}:${it.name}`;
                const typeLabel = it.type === 'characters' ? '角色' : it.type === 'hooks' ? '伏笔' : '世界观';
                return (
                  <div key={key} className="flex items-start justify-between gap-2 rounded-md bg-background p-2 text-sm">
                    <div>
                      <span className="mr-1 rounded bg-muted px-1 font-heading text-xs">{typeLabel}</span>
                      <b>{it.name}</b> <span className="text-muted-foreground">{it.desc}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="xs"
                        disabled={busy === key || busy === `${key}:dismiss`}
                        onClick={() => handleAdd(s.chapter, it.type, it.name)}
                      >
                        {busy === key ? '加入中…' : '加入知识库'}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy === key || busy === `${key}:dismiss`}
                        onClick={() => handleDismiss(s.chapter, it.type, it.name)}
                      >
                        {busy === `${key}:dismiss` ? '处理中…' : '放弃'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionLogView() {
  const [log, setLog] = useState<ActionLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chapterOrder = useChapterStore((s) => s.chapterOrder);

  const loadLog = () => {
    setLoading(true);
    api
      .get<ActionLog | null>('/memory/action-log')
      .then(setLog)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    loadLog();
  }, []);

  if (loading) return <div className="text-muted-foreground">加载中...</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (!log || log.entries.length === 0)
    return (
      <div className="text-muted-foreground">
        暂无操作记录。伏笔完成/激活、实体建议加入/放弃会记录在这里（即使放弃/关闭也保留）。
      </div>
    );

  const label: Record<string, string> = {
    hook_resolve: '标记伏笔完成',
    hook_reactivate: '重新激活伏笔',
    curation_accept: '实体建议加入知识库',
    curation_dismiss: '放弃实体建议',
  };

  return (
    <div className="space-y-2">
      {[...log.entries].reverse().map((e, i) => (
        <div key={i} className="rounded-md border bg-card p-3 text-sm shadow-sm">
          <div className="flex items-center justify-between">
            <span>
              <span className="rounded bg-muted px-1 font-heading text-xs">{label[e.action] ?? e.action}</span>{' '}
              <b>{e.target}</b>
            </span>
            <span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString('zh-CN')}</span>
          </div>
          {e.chapter != null && (
            <div className="mt-1 text-xs text-muted-foreground">
              相关第 {chapterOrder[e.chapter] ?? e.chapter} 章
              {e.category
                ? ` · ${e.category === 'characters' ? '角色' : e.category === 'hooks' ? '伏笔' : '世界观'}`
                : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
