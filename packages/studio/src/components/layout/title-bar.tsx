import { useEffect, useState } from 'react';
import { useBookStore } from '@/stores/book-store';

/**
 * 自定义标题栏(Electron frame:false)。
 * - 左侧显示当前书名(无书时显应用名);顶部拖拽区移动窗口
 * - 右侧窗口控制按钮(经 window.storyweaver IPC 调主进程)
 * - dev(浏览器)无 window.storyweaver,按钮 no-op
 */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const sw = typeof window !== 'undefined' ? window.storyweaver : undefined;
  const { book } = useBookStore();

  useEffect(() => {
    sw?.onMaximizedChange(setMaximized);
  }, [sw]);

  return (
    <div className="storyweaver-titlebar flex h-9 items-center justify-between border-b border-border bg-sidebar px-3 select-none">
      <span className="truncate font-heading text-sm text-sidebar-foreground">
        {book?.title ?? 'StoryWeaver · 朱批墨韵'}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => sw?.minimize()}
          className="flex h-6 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent/15"
          title="最小化"
        >
          —
        </button>
        <button
          onClick={() => sw?.toggleMaximize()}
          className="flex h-6 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent/15"
          title="最大化/还原"
        >
          {maximized ? '❐' : '▢'}
        </button>
        <button
          onClick={() => sw?.close()}
          className="flex h-6 w-8 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          title="关闭"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
