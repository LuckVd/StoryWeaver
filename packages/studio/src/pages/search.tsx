import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/lib/api-client';
import { useChapterStore } from '@/stores/chapter-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, ChevronLeft, ChevronRight } from 'lucide-react';

/** 搜索结果项（对齐后端 InMemorySearchEngine.SearchResult） */
type SearchResult = {
  type: 'chapter' | 'knowledge' | 'summary';
  id: string;
  title: string;
  snippet: string;
};

const scopes = [
  { value: 'all', label: '全部' },
  { value: 'chapters', label: '章节' },
  { value: 'knowledge', label: '知识库' },
  { value: 'summaries', label: '摘要' },
] as const;

const typeLabels: Record<string, string> = { chapter: '章节', knowledge: '知识库', summary: '摘要' };
const typeBadgeClass: Record<string, string> = {
  // 朱批墨韵:章节=墨,知识库=朱砂(AI 用),摘要=中性
  chapter: 'bg-primary/10 text-primary',
  knowledge: 'bg-vermilion/15 text-vermilion',
  summary: 'bg-muted text-muted-foreground',
};
const typeOrder = ['chapter', 'knowledge', 'summary'];
const PAGE_SIZE = 8;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 去 HTML 标签 + 压缩空白 + 截断 */
function cleanSnippet(raw: string, max = 160): string {
  const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

/** 高亮搜索词（大小写不敏感，按整词匹配） */
function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="rounded bg-vermilion/20 px-0.5 text-inherit">
        {p}
      </mark>
    ) : (
      p
    ),
  );
}

export function SearchPage() {
  const navigate = useNavigate();
  const chapterOrder = useChapterStore((s) => s.chapterOrder);
  const fetchVolumesAndChapters = useChapterStore((s) => s.fetchVolumesAndChapters);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // 章节序号映射(chapterId → 第N章),用于章节结果展示
  useEffect(() => {
    fetchVolumesAndChapters();
  }, [fetchVolumesAndChapters]);

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setPage(1);
    try {
      const res = await api.get<{ total: number; results: SearchResult[] }>(
        `/search?q=${encodeURIComponent(query.trim())}&scope=${scope}`,
      );
      setResults(res.results);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const paged = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const grouped = paged.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">搜索</h1>
      <form onSubmit={runSearch} className="mb-4 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索章节 / 知识库 / 摘要..."
          className="flex-1"
          autoFocus
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          {scopes.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={loading || !query.trim()}>
          <SearchIcon className="mr-1 h-4 w-4" />
          {loading ? '搜索中...' : '搜索'}
        </Button>
      </form>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {searched && !loading && (
        <div className="mb-4 text-sm text-muted-foreground">
          找到 {total} 条结果
          {results.length > PAGE_SIZE && ` · 第 ${page}/${totalPages} 页`}
        </div>
      )}

      {!loading &&
        typeOrder
          .filter((t) => grouped[t])
          .map((type) => (
            <div key={type} className="mb-6">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <span className={`rounded px-2 py-0.5 text-xs ${typeBadgeClass[type]}`}>
                  {typeLabels[type]}
                </span>
                <span className="text-muted-foreground">{grouped[type].length} 条</span>
              </h3>
              <div className="space-y-2">
                {grouped[type].map((r) => (
                  <div
                    key={`${r.type}-${r.id}`}
                    className={`rounded-lg border bg-card p-4 shadow-sm transition-colors ${
                      r.type === 'chapter' ? 'cursor-pointer hover:bg-accent/50' : ''
                    }`}
                    onClick={() => r.type === 'chapter' && navigate(`/chapters/${r.id}`)}
                  >
                    <div className="mb-1 font-medium">
                      {(r.type === 'chapter' || r.type === 'summary') && (
                        <span className="mr-1 text-muted-foreground">
                          第{chapterOrder[Number(r.id)] ?? r.id}章 ·{' '}
                        </span>
                      )}
                      {highlight(cleanSnippet(r.title, 60), query)}
                    </div>
                    <div className="text-sm leading-relaxed text-muted-foreground">
                      {highlight(cleanSnippet(r.snippet), query)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

      {!loading && searched && results.length === 0 && !error && (
        <div className="py-8 text-center text-muted-foreground">无匹配结果</div>
      )}

      {results.length > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
