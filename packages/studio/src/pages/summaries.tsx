import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/lib/api-client';
import { useChapterStore } from '@/stores/chapter-store';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import type { ChapterSummary, BatchSummary } from '@storyweaver/core';

type SummaryItem = {
  chapter: number;
  title: string;
  summary: ChapterSummary | null;
  generating: boolean;
};

export function SummariesPage() {
  const [tab, setTab] = useState<'chapter' | 'batch'>('chapter');
  const chapterOrder = useChapterStore((s) => s.chapterOrder);
  const fetchVolumesAndChapters = useChapterStore((s) => s.fetchVolumesAndChapters);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-bold">摘要</h1>

      <div className="mb-4 flex gap-2 border-b">
        <button
          onClick={() => setTab('chapter')}
          className={`-mb-px border-b-2 px-4 py-2 font-heading text-sm transition-colors ${
            tab === 'chapter'
              ? 'border-vermilion font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          章节摘要
        </button>
        <button
          onClick={() => setTab('batch')}
          className={`-mb-px border-b-2 px-4 py-2 font-heading text-sm transition-colors ${
            tab === 'batch'
              ? 'border-vermilion font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          综合总结
        </button>
      </div>

      {tab === 'chapter' ? <ChapterSummaries /> : <BatchSummaries />}
    </div>
  );
}

function ChapterSummaries() {
  const navigate = useNavigate();
  const chapterOrder = useChapterStore((s) => s.chapterOrder);
  const fetchVolumesAndChapters = useChapterStore((s) => s.fetchVolumesAndChapters);
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .get<SummaryItem[]>('/summaries')
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchVolumesAndChapters();
    load();
  }, []);

  useEffect(() => {
    if (!items.some((it) => it.generating)) return;
    const timer = setInterval(() => load(), 3000);
    return () => clearInterval(timer);
  }, [items]);

  const handleRegenerate = async (chapterId: number) => {
    setError(null);
    setItems((prev) => prev.map((it) => (it.chapter === chapterId ? { ...it, generating: true } : it)));
    try {
      await api.post(`/chapters/${chapterId}/summary`, {});
    } catch (e) {
      setError(e instanceof Error ? e.message : '启动生成失败');
      setItems((prev) => prev.map((it) => (it.chapter === chapterId ? { ...it, generating: false } : it)));
    }
  };

  if (loading) return <div className="text-muted-foreground">加载中...</div>;
  if (items.length === 0)
    return <div className="text-muted-foreground">暂无已发布章节。发布章节后会自动生成摘要。</div>;

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      )}
      <div className="space-y-4">
        {items.map((it) => {
          const isRegen = it.generating;
          return (
            <div key={it.chapter} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h3
                  className="cursor-pointer font-medium hover:text-primary"
                  onClick={() => navigate(`/chapters/${it.chapter}`)}
                >
                  第 {chapterOrder[it.chapter] ?? it.chapter} 章 · {it.title}
                </h3>
                {it.summary && !isRegen && (
                  <span className="text-xs text-muted-foreground">{it.summary.wordCount ?? 0} 字</span>
                )}
              </div>

              {isRegen ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" /> 摘要生成中…（约 30-90 秒）
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
                  </div>
                </div>
              ) : it.summary ? (
                <>
                  <p className="mb-2 text-sm">{it.summary.plotOutcome}</p>
                  {it.summary.plotEvents?.length > 0 && (
                    <div className="mb-2">
                      <div className="mb-1 text-xs text-muted-foreground">主要情节</div>
                      <ul className="ml-4 list-disc text-sm">
                        {it.summary.plotEvents.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {it.summary.charactersPresent?.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      出场角色：{it.summary.charactersPresent.join('、')}
                    </div>
                  )}
                  <div className="mt-3">
                    <Button variant="outline" size="xs" onClick={() => handleRegenerate(it.chapter)}>
                      <RefreshCw className="mr-1 h-3 w-3" /> 重新生成
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">尚未生成摘要</span>
                  <Button size="sm" onClick={() => handleRegenerate(it.chapter)}>
                    <RefreshCw className="mr-1 h-4 w-4" /> 生成摘要
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function BatchSummaries() {
  const chapterOrder = useChapterStore((s) => s.chapterOrder);
  const fetchVolumesAndChapters = useChapterStore((s) => s.fetchVolumesAndChapters);
  const [items, setItems] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .get<BatchSummary[]>('/summaries/batch')
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchVolumesAndChapters();
    load();
  }, []);

  if (loading) return <div className="text-muted-foreground">加载中...</div>;
  if (items.length === 0)
    return <div className="text-muted-foreground">暂无综合总结。每发布 10 章后会自动生成。</div>;

  const d = (id: number) => chapterOrder[id] ?? id;

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      )}
      <div className="space-y-4">
        {items.map((b) => (
          <div key={b.chapterRange[0]} className="rounded-lg border bg-card p-4 shadow-sm">
            <h3 className="mb-2 font-medium">
              第 {d(b.chapterRange[0])} - {d(b.chapterRange[1])} 章
            </h3>
            <p className="mb-3 text-sm">{b.narrativeArc}</p>
            {b.turningPoints.length > 0 && (
              <div className="mb-2">
                <div className="mb-1 text-xs text-muted-foreground">关键转折点</div>
                <ul className="ml-4 list-disc text-sm">
                  {b.turningPoints.map((tp, i) => (
                    <li key={i}>{tp}</li>
                  ))}
                </ul>
              </div>
            )}
            {Object.keys(b.characterDevelopment).length > 0 && (
              <div className="mb-2">
                <div className="mb-1 text-xs text-muted-foreground">角色发展</div>
                <ul className="ml-4 list-disc text-sm">
                  {Object.entries(b.characterDevelopment).map(([name, dev]) => (
                    <li key={name}>
                      <b>{name}</b>：{dev}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {b.unresolvedThreads.length > 0 && (
              <div>
                <div className="mb-1 text-xs text-muted-foreground">未解决的问题</div>
                <ul className="ml-4 list-disc text-sm">
                  {b.unresolvedThreads.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
