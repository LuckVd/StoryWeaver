import { useEffect, useState } from 'react';
import { useLibraryStore } from '@/stores/library-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Seal } from '@/components/ui/seal';
import { BookEditDialog, type BookMeta } from '@/components/book-edit-dialog';
import { ActivityGraph } from '@/components/activity-graph';
import { Pen, Trash2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiBase } from '@/lib/api-client';
import type { BookshelfItem } from '@storyweaver/core';
import type { FormEvent } from 'react';

/**
 * 书架页:列出所有书,新建/切换/编辑/导出/删除。
 * 朱批墨韵:宋体书名 + 卷·类型 eyebrow + 朱砂分隔 + 当前书印章(阅)。
 */
export function LibraryPage() {
  const {
    books,
    current,
    activity,
    loading,
    error,
    fetchLibrary,
    fetchActivity,
    activate,
    createBook,
    updateBook,
    deleteBook,
  } = useLibraryStore();
  const [creating, setCreating] = useState(false);
  const [editingBook, setEditingBook] = useState<BookshelfItem | null>(null);
  const [exportBook, setExportBook] = useState<BookshelfItem | null>(null);

  useEffect(() => {
    fetchLibrary();
    fetchActivity();
  }, [fetchLibrary, fetchActivity]);

  if (creating) {
    return <NewBookForm loading={loading} onSubmit={createBook} onCancel={() => setCreating(false)} />;
  }

  const handleDelete = async (book: BookshelfItem) => {
    if (!confirm(`删除《${book.title}》?该书的所有章节、知识库与摘要将被永久移除,此操作不可恢复。`)) {
      return;
    }
    await deleteBook(book.slug);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <p className="font-heading text-xs uppercase tracking-[0.3em] text-muted-foreground">书架</p>
          <h1 className="mt-2 font-heading text-4xl font-bold">我的作品</h1>
        </div>
        <Button variant="vermilion" onClick={() => setCreating(true)}>新建书籍</Button>
      </div>

      {activity.length > 0 && (
        <div className="mt-6">
          <ActivityGraph activity={activity} />
        </div>
      )}

      {error && <p className="mt-6 text-destructive">{error}</p>}

      {loading && books.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">加载中...</p>
      ) : books.length === 0 ? (
        <EmptyShelf onCreate={() => setCreating(true)} />
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <BookCard
              key={b.slug}
              book={b}
              current={current === b.slug}
              onOpen={() => activate(b.slug)}
              onEdit={() => setEditingBook(b)}
              onDelete={() => handleDelete(b)}
              onExport={() => setExportBook(b)}
            />
          ))}
        </div>
      )}

      {editingBook && (
        <BookEditDialog
          initial={editingBook}
          onSubmit={(patch: BookMeta) => updateBook(editingBook.slug, patch)}
          onClose={() => setEditingBook(null)}
        />
      )}

      {exportBook && <ExportBookDialog book={exportBook} onClose={() => setExportBook(null)} />}
    </div>
  );
}

function BookCard({
  book,
  current,
  onOpen,
  onEdit,
  onDelete,
  onExport,
}: {
  book: BookshelfItem;
  current: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group relative flex h-full cursor-pointer flex-col items-start rounded-lg border bg-card p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
        current ? 'border-vermilion' : 'border-border'
      }`}
    >
      {/* 右上角:编辑/导出/删除(阻止冒泡,不触发卡片打开) */}
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          aria-label="编辑"
          title="编辑"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <Pen className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="导出"
          title="导出"
          onClick={(e) => {
            e.stopPropagation();
            onExport();
          }}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="删除"
          title="删除"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <p className="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">卷 · {book.genre}</p>
        {current && <Seal variant="filled" className="h-4 w-4 text-[0.4rem]">阅</Seal>}
      </div>
      <h3 className="mt-3 font-heading text-2xl font-bold leading-tight">{book.title}</h3>
      {book.author && <p className="mt-1 font-heading text-xs text-muted-foreground">作者 · {book.author}</p>}
      <p className="mt-2 font-heading text-sm text-muted-foreground">
        {statusLabel(book.status)} · {book.language}
      </p>
      <div className="mt-auto w-full border-t border-dashed border-border pt-3 font-heading text-xs text-muted-foreground">
        {book.volumeCount} 卷 · {formatDate(book.updatedAt)}
      </div>
    </div>
  );
}

/** 导出弹框:选择格式(Markdown / 纯文本)→ 确认导出 */
function ExportBookDialog({ book, onClose }: { book: BookshelfItem; onClose: () => void }) {
  const [format, setFormat] = useState<'txt' | 'md'>('md');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadExport(book.slug, format, book.title);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-1 h-px w-12 bg-vermilion" />
          <CardTitle>导出《{book.title}》</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto space-y-4">
          <div className="space-y-2">
            <Label>选择格式</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('md')}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors',
                  format === 'md' ? 'border-vermilion bg-vermilion/5' : 'border-border hover:bg-muted',
                )}
              >
                <span className="font-heading text-sm font-medium">Markdown</span>
                <span className="text-xs text-muted-foreground">带 # 章节标题</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('txt')}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors',
                  format === 'txt' ? 'border-vermilion bg-vermilion/5' : 'border-border hover:bg-muted',
                )}
              >
                <span className="font-heading text-sm font-medium">纯文本 TXT</span>
                <span className="text-xs text-muted-foreground">无格式纯文字</span>
              </button>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            点击导出后由浏览器下载,文件名「{book.title}.{format === 'md' ? 'md' : 'txt'}」。
            保存位置由浏览器下载设置决定;若需每次选择保存位置,可在浏览器设置中开启「下载前询问每个文件的保存位置」。
          </p>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>取消</Button>
            <Button type="button" variant="vermilion" className="flex-1" disabled={exporting} onClick={handleExport}>
              {exporting ? '导出中...' : '导出'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyShelf({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <div className="mb-4 h-px w-12 bg-vermilion" />
      <p className="font-heading text-lg text-muted-foreground">书架空空如也</p>
      <p className="mt-1 text-sm text-muted-foreground">创建你的第一本书,开启创作之旅</p>
      <Button variant="vermilion" className="mt-6" onClick={onCreate}>新建第一本书</Button>
    </div>
  );
}

function NewBookForm({
  loading,
  onSubmit,
  onCancel,
}: {
  loading: boolean;
  onSubmit: (input: { title: string; author?: string; genre: string; language: string }) => void;
  onCancel: () => void;
}) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      title: fd.get('title') as string,
      author: (fd.get('author') as string) || undefined,
      genre: fd.get('genre') as string,
      language: (fd.get('language') as string) || 'zh-CN',
    });
  };

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-1 h-px w-12 bg-vermilion" />
          <CardTitle>新建书籍</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">书名</Label>
              <Input id="title" name="title" placeholder="输入小说标题" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">作者</Label>
              <Input id="author" name="author" placeholder="可选" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="genre">类型</Label>
              <Input id="genre" name="genre" placeholder="如：玄幻、都市、科幻" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">语言</Label>
              <Input id="language" name="language" defaultValue="zh-CN" />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>取消</Button>
              <Button type="submit" variant="vermilion" className="flex-1" disabled={loading}>
                {loading ? '创建中...' : '创建'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** 导出指定书为文件(文件名用书名) */
async function downloadExport(slug: string, format: 'txt' | 'md', title: string) {
  // 走统一 apiBase:桌面版用注入的 loopback 基址,web 版回退 /api/v1 代理(裸 /api 在桌面版 renderer 会拿到 HTML)
  const res = await fetch(`${apiBase}/library/${slug}/export?format=${format}`);
  if (!res.ok) {
    alert('导出失败');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title || 'export'}.${format === 'md' ? 'md' : 'txt'}`;
  a.click();
  URL.revokeObjectURL(url);
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    drafting: '构思中',
    in_progress: '创作中',
    completed: '已完成',
    archived: '已归档',
  };
  return map[status] ?? status;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('zh-CN');
  } catch {
    return '';
  }
}
