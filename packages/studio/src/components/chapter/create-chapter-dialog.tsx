import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VolumeMeta } from '@storyweaver/core';

interface CreateChapterDialogProps {
  open: boolean;
  volumes: VolumeMeta[];
  onClose: () => void;
  onSubmit: (volume: number, title: string) => void;
  loading?: boolean;
}

export function CreateChapterDialog({ open, volumes, onClose, onSubmit, loading }: CreateChapterDialogProps) {
  const [volume, setVolume] = useState(volumes[0]?.id ?? 0);
  const [title, setTitle] = useState('');

  // 选中卷宗被从列表移除时回退到第一个，避免提交无效 volume
  useEffect(() => {
    if (volumes.length > 0 && !volumes.some((v) => v.id === volume)) {
      setVolume(volumes[0].id);
    }
  }, [volumes, volume]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim() && volume > 0) {
      onSubmit(volume, title.trim());
      setTitle('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>创建章节</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ch-volume">卷宗</Label>
              <select
                id="ch-volume"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {volumes.map((v) => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-title">章节标题</Label>
              <Input id="ch-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：第一章 起点" autoFocus />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button type="submit" disabled={!title.trim() || loading}>{loading ? '创建中...' : '创建'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
