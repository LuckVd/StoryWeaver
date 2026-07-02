import { useState, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { BookStatus } from '@storyweaver/core';

/** 可编辑的书籍元信息子集(书名/作者/类型/语言/状态) */
export interface BookMeta {
  title: string;
  author?: string;
  genre: string;
  language: string;
  status: BookStatus;
}

/**
 * 书籍信息编辑弹窗(共享):dashboard 编辑当前书、书架编辑任意书都用它。
 * 提交语义由父组件的 onSubmit 决定(PUT /book 当前书,或 PUT /library/:slug 指定书)。
 */
export function BookEditDialog({
  initial,
  onSubmit,
  onClose,
}: {
  initial: BookMeta;
  onSubmit: (patch: BookMeta) => Promise<void> | void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const patch: BookMeta = {
      title: fd.get('title') as string,
      author: (fd.get('author') as string) || undefined,
      genre: fd.get('genre') as string,
      language: fd.get('language') as string,
      status: fd.get('status') as BookStatus,
    };
    setSaving(true);
    try {
      await onSubmit(patch);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="shrink-0 items-center text-center">
          <div className="mx-auto mb-1 h-px w-12 bg-vermilion" />
          <CardTitle>编辑书籍信息</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">书名</Label>
              <Input id="title" name="title" defaultValue={initial.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">作者</Label>
              <Input id="author" name="author" defaultValue={initial.author ?? ''} placeholder="可选" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="genre">类型</Label>
              <Input id="genre" name="genre" defaultValue={initial.genre} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">语言</Label>
              <Input id="language" name="language" defaultValue={initial.language} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">状态</Label>
              <select
                id="status"
                name="status"
                defaultValue={initial.status}
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="drafting">构思中</option>
                <option value="in_progress">创作中</option>
                <option value="completed">已完成</option>
                <option value="archived">已归档</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>取消</Button>
              <Button type="submit" variant="vermilion" className="flex-1" disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
