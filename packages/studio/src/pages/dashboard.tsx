import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useBookStore } from '@/stores/book-store';
import { Button } from '@/components/ui/button';

interface BookStats {
  chapters: { total: number; draft: number; approved: number; published: number };
  totalWords: number;
  avgWords: number;
  maxWords: number;
  minWords: number;
  lastUpdatedAt: string | null;
}

export function DashboardPage() {
  const { book, loading, error, fetchBook } = useBookStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<BookStats | null>(null);

  useEffect(() => {
    fetchBook();
  }, [fetchBook]);

  useEffect(() => {
    fetch('/api/v1/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (loading && !book) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">加载中...</div>;
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-destructive">{error}</div>;
  }

  if (!book) {
    // 无打开的书:引导前往书架
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-4 h-px w-12 bg-vermilion" />
        <p className="font-heading text-lg text-muted-foreground">尚无打开的书</p>
        <p className="mt-1 text-sm text-muted-foreground">前往书架选择或创建一本书</p>
        <Button variant="vermilion" className="mt-6" onClick={() => navigate('/library')}>
          打开书架
        </Button>
      </div>
    );
  }

  const days = daysSince(book.createdAt);
  const total = stats?.chapters.total ?? 0;
  const published = stats?.chapters.published ?? 0;
  const dailyAvg = days > 0 ? Math.round((stats?.totalWords ?? 0) / days) : stats?.totalWords ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* 扉页:卷·类型 eyebrow + 宋体大书名 + 作者副标题 + 朱砂分隔 + 创作时间副行 */}
      <div className="border-b border-border pb-8 text-center">
        <p className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">
          卷 · {book.genre}
        </p>
        <h1 className="mt-4 font-heading text-5xl font-bold leading-tight">{book.title}</h1>
        {book.author && (
          <p className="mt-2 font-heading text-sm text-muted-foreground">作者 · {book.author}</p>
        )}
        <p className="mt-3 font-heading text-sm text-muted-foreground">
          {statusLabel(book.status)} · {book.language}
        </p>
        <div className="mx-auto mt-6 h-px w-24 bg-vermilion" />
        <p className="mt-4 font-heading text-xs text-muted-foreground">
          始于 {formatDate(book.createdAt)}
          {days > 0 ? ` · 已创作 ${days} 天` : ''}
          {` · 更新 ${formatDate(book.updatedAt)}`}
        </p>
      </div>

      {/* 篇幅(字数仅统计已发布章节) */}
      <Section title="篇幅">
        <StatRow label="已发布字数" value={stats ? fmtNum(stats.totalWords) : '—'} accent />
        <StatRow label="章节总数" value={stats ? total : '—'} />
        <StatRow label="平均字数" value={stats ? fmtNum(stats.avgWords) : '—'} />
        <StatRow
          label="最长 · 最短"
          value={stats && published ? `${fmtNum(stats.maxWords)} · ${fmtNum(stats.minWords)}` : '—'}
        />
      </Section>

      {/* 进度 */}
      <Section title="进度">
        <StatRow label="卷数" value={book.volumes.length} />
        <StatRow label="草稿" value={stats ? stats.chapters.draft : '—'} />
        <StatRow label="审阅中" value={stats ? stats.chapters.approved : '—'} />
        <StatRow label="已发布" value={stats ? published : '—'} accent />
      </Section>

      {/* 节奏 */}
      <Section title="节奏">
        <StatRow label="创作天数" value={`${days} 天`} />
        <StatRow label="日均字数" value={fmtNum(dailyAvg)} />
        <StatRow label="最近写作" value={stats?.lastUpdatedAt ? relativeTime(stats.lastUpdatedAt) : '—'} />
      </Section>
    </div>
  );
}

/** 分节:朱砂短杠 + 小标题 + 虚线目录式统计行 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-px w-6 bg-vermilion" />
        <h2 className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">{title}</h2>
      </div>
      <dl className="mx-auto grid max-w-md gap-x-10 gap-y-2 font-heading text-sm sm:grid-cols-[auto_1fr]">
        {children}
      </dl>
    </section>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    drafting: '构思中',
    in_progress: '创作中',
    completed: '已完成',
    archived: '已归档',
  };
  return map[status] ?? status;
}

/** 统计行:宋体 label + 右对齐数字,虚线分隔;accent 用朱砂 */
function StatRow({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <>
      <dt className="border-b border-dashed border-border pb-1 text-muted-foreground">{label}</dt>
      <dd className="border-b border-dashed border-border pb-1 text-right text-2xl font-medium">
        <span className={accent ? 'text-vermilion' : 'text-foreground'}>{value}</span>
      </dd>
    </>
  );
}

function fmtNum(n: number): string {
  return n.toLocaleString('zh-CN');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('zh-CN');
  } catch {
    return iso;
  }
}

/** 距今天数(不足一天算 0) */
function daysSince(iso: string): number {
  try {
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  } catch {
    return 0;
  }
}

/** 相对时间:今天 / 昨天 / N 天前 / N 个月前 */
function relativeTime(iso: string): string {
  const days = daysSince(iso);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}
