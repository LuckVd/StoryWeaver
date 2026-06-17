import { useEffect, useState } from 'react';
import { useChapterStore } from '@/stores/chapter-store';
import { Button } from '@/components/ui/button';
import { X, RotateCcw } from 'lucide-react';
import { DiffViewer } from './diff-viewer';
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
  const { versions, currentChapter, fetchVersions, restoreVersion } = useChapterStore();
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingVersions(true);
    fetchVersions(chapterId).finally(() => {
      if (!cancelled) setLoadingVersions(false);
    });
    return () => {
      cancelled = true;
    };
  }, [chapterId, fetchVersions]);

  const handleRestore = async (versionId: number) => {
    await restoreVersion(chapterId, versionId);
    setSelectedId(null);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const selected = versions.find((v) => v.id === selectedId);

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

      {selected ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <span className="text-xs text-muted-foreground">
              差异：v{selected.id}（{triggerLabel[selected.trigger]}）→ 当前
            </span>
            <div className="flex-1" />
            <Button size="xs" onClick={() => handleRestore(selected.id)} title="恢复到此版本">
              <RotateCcw className="mr-1 h-3 w-3" /> 恢复
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => setSelectedId(null)} title="返回列表">
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <DiffViewer
              oldText={selected.content}
              newText={currentChapter?.content ?? ''}
              oldLabel={`v${selected.id} 历史版本`}
              newLabel="当前内容"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {loadingVersions && versions.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">加载中…</div>
          )}
          {versions.length === 0 && !loadingVersions && (
            <div className="px-4 py-3 text-sm text-muted-foreground">暂无版本记录</div>
          )}
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedId(v.id)}
              className="flex w-full items-start gap-2 border-b px-4 py-2 text-left transition-colors last:border-b-0 hover:bg-accent/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">v{v.id}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {triggerLabel[v.trigger]}
                  </span>
                </div>
                {v.description && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{v.description}</div>
                )}
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {formatTime(v.createdAt)} · {v.wordCount} 字
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
