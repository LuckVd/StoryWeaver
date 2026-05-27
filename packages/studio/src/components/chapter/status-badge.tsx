import { cn } from '@/lib/utils';
import type { ChapterStatus } from '@storyweaver/core';

const config: Record<ChapterStatus, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-muted text-muted-foreground' },
  approved: { label: '已审阅', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  published: { label: '已发布', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

export function StatusBadge({ status }: { status: ChapterStatus }) {
  const { label, className } = config[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  );
}
