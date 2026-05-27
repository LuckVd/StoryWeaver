import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CreateVolumeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string) => void;
  loading?: boolean;
}

export function CreateVolumeDialog({ open, onClose, onSubmit, loading }: CreateVolumeDialogProps) {
  const [title, setTitle] = useState('');

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit(title.trim());
      setTitle('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>创建卷宗</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vol-title">卷标题</Label>
              <Input id="vol-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：第一卷" autoFocus />
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
