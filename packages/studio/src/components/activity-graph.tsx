import { cn } from '@/lib/utils';

interface ActivityDay {
  date: string;
  words: number;
}

/** 朱砂色阶(5 级):0=无写作,4=当日字数最多 */
const LEVEL_CLASS = [
  'bg-muted-foreground/15',
  'bg-vermilion/25',
  'bg-vermilion/45',
  'bg-vermilion/70',
  'bg-vermilion',
];

function level(words: number, max: number): number {
  if (words <= 0 || max <= 0) return 0;
  const r = words / max;
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 0.75) return 3;
  return 4;
}

function fmtNum(n: number): string {
  return n.toLocaleString('zh-CN');
}

/**
 * 写作活跃热力图(GitHub contribution 风格)。
 * 周列 × 7 行(周几),每格一天,颜色深浅由当日字数决定(朱砂色阶)。
 */
export function ActivityGraph({ activity }: { activity: ActivityDay[] }) {
  if (activity.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-heading text-sm font-medium">写作活跃</h3>
        <p className="mt-2 text-sm text-muted-foreground">暂无写作记录</p>
      </div>
    );
  }

  const max = Math.max(1, ...activity.map((a) => a.words));
  const activeDays = activity.filter((a) => a.words > 0).length;
  const totalWords = activity.reduce((s, a) => s + a.words, 0);

  // 对齐到周日:开头补空格,尾部补齐 7 的倍数
  const cells: (ActivityDay | null)[] = [];
  const startWd = new Date(activity[0].date).getDay();
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (const a of activity) cells.push(a);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (ActivityDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // 月份标签:月份变化的那一列标「N月」
  const monthLabels = weeks.map((week, i) => {
    const first = week.find((c) => c);
    if (!first) return null;
    const m = new Date(first.date).getMonth();
    const prev = i > 0 ? weeks[i - 1].find((c) => c) : null;
    const prevM = prev ? new Date(prev.date).getMonth() : -1;
    return m !== prevM ? `${m + 1}月` : null;
  });

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-sm font-medium">写作活跃</h3>
        <span className="text-xs text-muted-foreground">
          近 {activity.length} 天 · 写作 {activeDays} 天 · {fmtNum(totalWords)} 字
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* 月份标签 */}
          <div className="mb-1 flex gap-[3px]">
            {monthLabels.map((label, i) => (
              <div key={i} className="w-[11px] text-[9px] leading-none text-muted-foreground">
                {label && <span className="whitespace-nowrap">{label}</span>}
              </div>
            ))}
          </div>
          {/* 热力网格:周列 × 7 行 */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((cell, di) => (
                  <div
                    key={di}
                    title={cell ? `${cell.date} · ${fmtNum(cell.words)} 字` : undefined}
                    className={cn(
                      'size-[11px] rounded-sm',
                      cell ? LEVEL_CLASS[level(cell.words, max)] : 'bg-transparent',
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* 图例 */}
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>少</span>
        {LEVEL_CLASS.map((c, i) => (
          <div key={i} className={cn('size-[11px] rounded-sm', c)} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
