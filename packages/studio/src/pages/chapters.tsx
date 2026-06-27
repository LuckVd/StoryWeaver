import { useEffect, useState } from 'react';
import { useChapterStore } from '@/stores/chapter-store';
import { ChapterList } from '@/components/chapter/chapter-list';
import { CreateVolumeDialog } from '@/components/chapter/create-volume-dialog';
import { CreateChapterDialog } from '@/components/chapter/create-chapter-dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function ChaptersPage() {
  const { volumes, chaptersByVolume, loading, error, fetchVolumesAndChapters, createVolume, createChapter, deleteChapter, updateChapterStatus } = useChapterStore();
  const [showCreateVolume, setShowCreateVolume] = useState(false);
  const [showCreateChapter, setShowCreateChapter] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    danger?: boolean;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    fetchVolumesAndChapters();
  }, [fetchVolumesAndChapters]);

  const handleDelete = (id: number) => {
    setConfirmState({
      title: '删除章节',
      message: '确定删除此章节？此操作不可撤销。',
      danger: true,
      action: () => deleteChapter(id),
    });
  };

  const handlePublish = (id: number) => {
    setConfirmState({
      title: '定稿发布',
      message: '定稿发布后章节将不可修改，确定继续？',
      action: () => updateChapterStatus(id, 'published'),
    });
  };

  const runConfirm = async () => {
    if (!confirmState) return;
    await confirmState.action();
    setConfirmState(null);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">章节管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCreateVolume(true)}>
            <Plus className="mr-1 h-4 w-4" /> 创建卷
          </Button>
          {volumes.length > 0 && (
            <Button onClick={() => setShowCreateChapter(true)}>
              <Plus className="mr-1 h-4 w-4" /> 创建章节
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && volumes.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">加载中...</div>
      ) : (
        <ChapterList volumes={volumes} chaptersByVolume={chaptersByVolume} onDelete={handleDelete} onPublish={handlePublish} />
      )}

      <CreateVolumeDialog
        open={showCreateVolume}
        onClose={() => setShowCreateVolume(false)}
        onSubmit={async (title) => { await createVolume(title); setShowCreateVolume(false); }}
        loading={loading}
      />
      <CreateChapterDialog
        open={showCreateChapter}
        volumes={volumes}
        onClose={() => setShowCreateChapter(false)}
        onSubmit={async (vol, title) => {
          await createChapter(vol, title);
          if (!useChapterStore.getState().error) setShowCreateChapter(false);
        }}
        loading={loading}
      />
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        variant={confirmState?.danger ? 'danger' : 'default'}
        onConfirm={runConfirm}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
