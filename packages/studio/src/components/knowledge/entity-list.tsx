import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export interface ColumnDef<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface EntityListProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  data: T[];
  onCreate: () => void;
  onEdit: (item: T) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
  emptyText?: string;
  createLabel?: string;
}

export function EntityList<T extends { id: string }>({
  columns,
  data,
  onCreate,
  onEdit,
  onDelete,
  loading,
  emptyText = '暂无数据',
  createLabel = '新建',
}: EntityListProps<T>) {
  const [delTarget, setDelTarget] = useState<string | null>(null);

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {createLabel}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {createLabel}
        </Button>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-2 text-left font-medium text-muted-foreground">
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/30">
                {columns.map((col) => (
                  <td key={col.key} className="max-w-xs truncate px-3 py-2">
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-xs" onClick={() => onEdit(item)} title="编辑">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDelTarget(item.id)}
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!delTarget}
        title="删除"
        message="确定删除该条目？此操作不可撤销。"
        variant="danger"
        confirmText="删除"
        onConfirm={() => {
          if (delTarget) onDelete(delTarget);
          setDelTarget(null);
        }}
        onClose={() => setDelTarget(null)}
      />
    </div>
  );
}
