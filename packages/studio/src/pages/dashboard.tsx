import { useEffect } from 'react';
import { useBookStore } from '@/stores/book-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, Layers, FileText } from 'lucide-react';
import type { FormEvent } from 'react';

export function DashboardPage() {
  const { book, loading, error, fetchBook, createBook } = useBookStore();

  useEffect(() => {
    fetchBook();
  }, [fetchBook]);

  if (loading && !book) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">加载中...</div>;
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-destructive">{error}</div>;
  }

  if (!book) {
    return <CreateBookForm onSubmit={createBook} loading={loading} />;
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">{book.title}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">卷数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{book.volumes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">章节总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{book.nextChapterId - 1}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-muted-foreground">状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusLabel(book.status)}</div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 text-sm text-muted-foreground">
        类型：{book.genre} · 语言：{book.language}
      </div>
      <div className="mt-6 flex gap-2">
        <Button variant="outline" onClick={() => downloadExport('txt')}>
          导出 TXT
        </Button>
        <Button variant="outline" onClick={() => downloadExport('md')}>
          导出 Markdown
        </Button>
      </div>
    </div>
  );
}

async function downloadExport(format: 'txt' | 'md') {
  const res = await fetch(`/api/v1/export?format=${format}`);
  if (!res.ok) {
    alert('导出失败');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `export.${format === 'md' ? 'md' : 'txt'}`;
  a.click();
  URL.revokeObjectURL(url);
}

function CreateBookForm({ onSubmit, loading }: { onSubmit: (input: { title: string; genre: string; language: string }) => void; loading: boolean }) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      title: fd.get('title') as string,
      genre: fd.get('genre') as string,
      language: fd.get('language') as string || 'zh-CN',
    });
  };

  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>创建你的小说</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">书名</Label>
              <Input id="title" name="title" placeholder="输入小说标题" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="genre">类型</Label>
              <Input id="genre" name="genre" placeholder="如：玄幻、都市、科幻" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">语言</Label>
              <Input id="language" name="language" defaultValue="zh-CN" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '创建中...' : '创建书籍'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
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
