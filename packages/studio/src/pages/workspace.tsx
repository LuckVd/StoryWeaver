import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useChapterStore } from '@/stores/chapter-store';
import { Button } from '@/components/ui/button';
import { Package, CheckCircle2, Upload } from 'lucide-react';

/**
 * 工作区与发布页（C1）
 *
 * 将已定稿（approved）章节加入工作区，勾选后批量发布。发布后章节锁定为
 * published、自动生成章节摘要与剧情状态（激活原 workspace-service 的总结链路）。
 */
export function WorkspacePage() {
  const {
    chapters: wsChapters,
    loading,
    error,
    publishing,
    publishProgress,
    publishResult,
    fetchWorkspace,
    addChapter,
    removeChapter,
    publish,
    clearPublish,
  } = useWorkspaceStore();
  const { chaptersByVolume, chapterOrder, fetchVolumesAndChapters } = useChapterStore();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchWorkspace();
    fetchVolumesAndChapters();
  }, [fetchWorkspace, fetchVolumesAndChapters]);

  const wsIds = new Set(wsChapters.map((c) => c.id));
  const allChapters = Object.entries(chaptersByVolume).flatMap(([vol, chs]) =>
    chs.map((c) => ({ ...c, volume: Number(vol) })),
  );
  const approvedAvailable = allChapters
    .filter((c) => c.status === 'approved' && !wsIds.has(c.id))
    .sort((a, b) => a.id - b.id);
  const wsApproved = wsChapters.filter((c) => c.status === 'approved').sort((a, b) => a.id - b.id);

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handlePublish = async () => {
    if (selected.size === 0) return;
    await publish([...selected]);
    setSelected(new Set());
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-bold">工作区与发布</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        将已定稿（approved）的章节加入工作区，勾选后批量发布。发布后章节锁定为 published、自动生成摘要与剧情状态。
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {publishing && publishProgress && (
        <div className="mb-4 rounded-md border bg-card p-3 text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 animate-pulse" />
            {publishProgress.step === 'summarizing' ? '生成摘要中' : '发布中'}… {publishProgress.current}/
            {publishProgress.total}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(publishProgress.current / Math.max(publishProgress.total, 1)) * 100}%` }}
            />
          </div>
        </div>
      )}
      {publishResult && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <div className="flex items-center justify-between">
            <span>
              <CheckCircle2 className="mr-1 inline h-4 w-4" />
              发布完成：成功 {publishResult.published.length} 章
              {publishResult.summarized.length > 0 && `、生成摘要 ${publishResult.summarized.length} 章`}
              {publishResult.skipped.length > 0 && `、跳过 ${publishResult.skipped.length} 章`}
            </span>
            <button onClick={clearPublish} className="text-xs underline">
              关闭
            </button>
          </div>
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <Package className="h-4 w-4" /> 工作区（待发布）
        </h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">加载中…</div>
        ) : wsApproved.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            工作区暂无已定稿章节。把下方 approved 章节加入工作区后再发布。
          </div>
        ) : (
          <>
            <ul className="mb-2 space-y-1">
              {wsApproved.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="flex-1">
                    第 {chapterOrder[c.id] ?? c.id} 章 · {c.title}
                  </span>
                  <button
                    onClick={() => removeChapter(c.id)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    移出
                  </button>
                </li>
              ))}
            </ul>
            <Button onClick={handlePublish} disabled={publishing || selected.size === 0}>
              {publishing ? '发布中…' : `发布选中（${selected.size}）`}
            </Button>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">已定稿（approved）未加入工作区</h2>
        {approvedAvailable.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            暂无。在章节页将章节定稿（approved）后会出现在这里。
          </div>
        ) : (
          <ul className="space-y-1">
            {approvedAvailable.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                <span className="flex-1">
                  第 {chapterOrder[c.id] ?? c.id} 章 · {c.title}
                </span>
                <Button size="xs" variant="outline" onClick={() => addChapter(c.id)}>
                  加入工作区
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
