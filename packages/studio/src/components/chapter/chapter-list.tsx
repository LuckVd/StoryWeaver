import { ChapterRow } from './chapter-row';
import type { VolumeMeta, ChapterMeta } from '@storyweaver/core';

interface ChapterListProps {
  volumes: VolumeMeta[];
  chaptersByVolume: Record<number, ChapterMeta[]>;
  onDelete?: (id: number) => void;
  onPublish?: (id: number) => void;
}

export function ChapterList({ volumes, chaptersByVolume, onDelete, onPublish }: ChapterListProps) {
  if (volumes.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">暂无卷宗，请先创建一个卷宗</div>;
  }

  return (
    <div className="space-y-6">
      {volumes.map((volume) => {
        const chapters = (chaptersByVolume[volume.id] ?? []).sort((a, b) => a.id - b.id);
        return (
          <div key={volume.id}>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">{volume.title}</h3>
            <div className="space-y-2">
              {chapters.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">暂无章节</p>
              ) : (
                chapters.map((ch) => (
                  <ChapterRow key={ch.id} chapter={ch} onDelete={onDelete} onPublish={onPublish} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
