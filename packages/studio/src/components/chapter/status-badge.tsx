import { cn } from '@/lib/utils';
import type { ChapterStatus } from '@storyweaver/core';

const config: Record<ChapterStatus, { label: string; className: string }> = {
  // 朱批墨韵:草稿中性 → 已审阅朱砂(盖印)→ 已发布墨(定稿)
  draft: { label: '草稿', className: 'bg-muted text-muted-foreground' },
  approved: { label: '已审阅', className: 'bg-vermilion/15 text-vermilion border border-vermilion/30' },
  published: { label: '已发布', className: 'bg-foreground/10 text-foreground' },
};

export function StatusBadge({ status }: { status: ChapterStatus }) {
  const { label, className } = config[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 font-heading text-xs font-medium', className)}>
      {label}
    </span>
  );
}
