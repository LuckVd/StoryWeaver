import { useEffect } from 'react';
import { useChapterStore } from '@/stores/chapter-store';
import { Button } from '@/components/ui/button';
import { X, RotateCcw } from 'lucide-react';
import type { VersionTrigger } from '@storyweaver/core';

interface VersionPanelProps {
  chapterId: number;
  onClose: () => void;
}

const triggerLabel: Record<VersionTrigger, string> = {
  save: '手动保存',
  ai_apply: 'AI 应用',
  status_change: '状态变更',
};

export function VersionPanel({ chapterId, onClose }: VersionPanelProps) {
  const { versions, loading, fetchVersions, restoreVersion } = useChapterStore();

  useEffect(() => {
    fetchVersions(chapterId);
  }, [chapterId, fetchVersions]);

  const handleRestore = async (versionId: number) => {
    await restoreVersion(chapterId, versionId);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-semibold">版本历史</span>
        <span className="text-xs text-muted-foreground">({versions.length})</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && versions.length === 0 && (
          <div className="px-4 py-3 text-sm text-muted-foreground">加载中…</div>
        )}
        {versions.length === 0 && !loading && (
          <div className="px-4 py-3 text-sm text-muted-foreground">暂无版本记录</div>
        )}
        {versions.map((v) => (
          <div
            key={v.id}
            className="flex items-start gap-2 border-b px-4 py-2 last:border-b-0"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  v{v.id}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {triggerLabel[v.trigger]}
                </span>
              </div>
              {v.description && (
                <div className="mt-0.5 text-xs text-muted-foreground truncate">
                  {v.description}
                </div>
              )}
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatTime(v.createdAt)} · {v.wordCount} 字
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleRestore(v.id)}
              title="恢复到此版本"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
