import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import type { Timeline, CharacterStates, CurationSuggestions } from '@storyweaver/core';
import { useChapterStore } from '@/stores/chapter-store';

/**
 * AI 记忆库页面（G03-S08）
 *
 * 展示发布流程自动维护的派生记忆：时间线 + 角色状态变迁。
 * 数据由 GET /memory/timeline 与 /memory/character-states 提供。
 */
export function MemoryPage() {
  const [tab, setTab] = useState<'timeline' | 'characters' | 'curator'>('timeline');
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [characters, setCharacters] = useState<CharacterStates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchVolumesAndChapters = useChapterStore((s) => s.fetchVolumesAndChapters);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<Timeline | null>('/memory/timeline'),
      api.get<CharacterStates | null>('/memory/character-states'),
    ])
      .then(([t, c]) => {
        setTimeline(t);
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
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex gap-2 border-b">
        {(['timeline', 'characters', 'curator'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === t
                ? 'border-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'timeline' ? '时间线' : t === 'characters' ? '角色状态' : '实体建议'}
          </button>
        ))}
      </div>

      {tab === 'timeline' ? (
        <TimelineView timeline={timeline} />
      ) : tab === 'characters' ? (
        <CharactersView states={characters} />
      ) : (
        <CuratorView />
      )}
    </div>
  );
}

function TimelineView({ timeline }: { timeline: Timeline | null }) {
  const chapterOrder = useChapterStore((s) => s.chapterOrder);
  if (!timeline || timeline.entries.length === 0)
    return <div className="text-muted-foreground">暂无时间线数据。发布章节后会自动生成。</div>;
  return (
    <div className="space-y-3">
      {timeline.entries.map((e) => (
        <div key={e.chapter} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-medium">
              第 {chapterOrder[e.chapter] ?? e.chapter} 章 · {e.title}
            </h3>
            {e.narrativeTime && <span className="text-xs text-muted-foreground">{e.narrativeTime}</span>}
          </div>
          {e.events.length > 0 && (
            <ul className="mb-1 ml-4 list-disc text-sm">
              {e.events.map((ev, i) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">结果：{e.outcome}</p>
        </div>
      ))}
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
    payload: Record<string, unknown>,
  ) => {
    const key = `${chapter}:${type}:${payload.name}`;
    setBusy(key);
    setError(null);
    try {
      if (type === 'characters') {
        await api.post('/knowledge/characters', { name: payload.name, description: payload.description });
      } else if (type === 'worldEntries') {
        await api.post('/knowledge/world', { name: payload.name, category: payload.category, content: payload.content });
      } else {
        await api.post('/knowledge/hooks', {
          name: payload.name,
          description: payload.description,
          status: 'active',
          plantedAt: chapter,
        });
      }
      await api.post('/memory/curation/remove', { chapter, type, name: payload.name });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入失败');
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
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
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
          <div key={s.chapter} className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="mb-2 font-medium">第 {s.chapter} 章建议</h3>
            <div className="space-y-2">
              {items.map((it) => {
                const key = `${s.chapter}:${it.type}:${it.name}`;
                const typeLabel = it.type === 'characters' ? '角色' : it.type === 'hooks' ? '伏笔' : '世界观';
                return (
                  <div key={key} className="flex items-start justify-between gap-2 rounded-md bg-background p-2 text-sm">
                    <div>
                      <span className="mr-1 rounded bg-muted px-1 text-xs">{typeLabel}</span>
                      <b>{it.name}</b> <span className="text-muted-foreground">{it.desc}</span>
                    </div>
                    <Button
                      size="xs"
                      disabled={busy === key}
                      onClick={() => handleAdd(s.chapter, it.type, it.payload)}
                    >
                      {busy === key ? '加入中…' : '加入知识库'}
                    </Button>
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
