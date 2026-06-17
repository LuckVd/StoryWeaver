import { Link } from 'react-router';
import { Trash2, Send } from 'lucide-react';
import { StatusBadge } from './status-badge';
import { Button } from '@/components/ui/button';
import { useChapterStore } from '@/stores/chapter-store';
import type { ChapterMeta } from '@storyweaver/core';

interface ChapterRowProps {
  chapter: ChapterMeta;
  isLatest?: boolean;
  onDelete?: (id: number) => void;
  onPublish?: (id: number) => void;
}

export function ChapterRow({ chapter, isLatest, onDelete, onPublish }: ChapterRowProps) {
  const chapterNo = useChapterStore((s) => s.chapterOrder[chapter.id]);
  return (
    <div className="group flex items-center justify-between rounded-md border bg-card px-4 py-3 transition-colors hover:bg-accent/50">
      <Link to={`/chapters/${chapter.id}`} className="flex flex-1 items-center gap-3">
        <span className="text-sm text-muted-foreground">第 {chapterNo ?? chapter.id} 章</span>
        <span className="font-medium">{chapter.title}</span>
        <StatusBadge status={chapter.status} />
      </Link>
      <div className="flex items-center gap-1">
        {chapter.status === 'approved' && onPublish && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.preventDefault(); onPublish(chapter.id); }}
            title="定稿发布"
          >
            <Send className="h-4 w-4 text-green-600" />
          </Button>
        )}
        {isLatest && chapter.status !== 'published' && onDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.preventDefault(); onDelete(chapter.id); }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}
