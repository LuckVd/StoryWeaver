import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';
import { StatusBadge } from './status-badge';
import { Button } from '@/components/ui/button';
import type { ChapterMeta } from '@storyweaver/core';

interface ChapterRowProps {
  chapter: ChapterMeta;
  onDelete?: (id: number) => void;
}

export function ChapterRow({ chapter, onDelete }: ChapterRowProps) {
  return (
    <div className="group flex items-center justify-between rounded-md border bg-card px-4 py-3 transition-colors hover:bg-accent/50">
      <Link to={`/chapters/${chapter.id}`} className="flex flex-1 items-center gap-3">
        <span className="text-sm text-muted-foreground">#{chapter.id}</span>
        <span className="font-medium">{chapter.title}</span>
        <StatusBadge status={chapter.status} />
      </Link>
      {chapter.status === 'draft' && onDelete && (
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
  );
}
