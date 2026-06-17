import { diffLines } from 'diff';

interface DiffViewerProps {
  /** 旧文本（HTML 或纯文本） */
  oldText: string;
  /** 新文本（HTML 或纯文本） */
  newText: string;
  /** 左侧标签（如"历史版本"） */
  oldLabel?: string;
  /** 右侧标签（如"当前内容"） */
  newLabel?: string;
}

/** HTML → 纯文本（段落用换行分隔，便于按行 diff） */
function toPlainText(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * 类 git diff 视图：按行对比 oldText → newText，新增绿色、删除红色（删除线）。
 * 输入是章节 HTML 内容，先转纯文本再按行 diff。
 */
export function DiffViewer({ oldText, newText, oldLabel, newLabel }: DiffViewerProps) {
  const parts = diffLines(toPlainText(oldText), toPlainText(newText));
  const hasChange = parts.some((p) => p.added || p.removed);

  return (
    <div className="overflow-auto rounded-md border bg-background text-xs" style={{ maxHeight: '55vh' }}>
      {oldLabel || newLabel ? (
        <div className="sticky top-0 flex border-b bg-muted/50 text-[11px] text-muted-foreground">
          <span className="flex-1 px-2 py-1">{oldLabel ?? '旧'}</span>
          <span className="flex-1 px-2 py-1">{newLabel ?? '新'}</span>
        </div>
      ) : null}
      {!hasChange ? (
        <div className="px-3 py-4 text-center text-muted-foreground">内容完全相同，无差异</div>
      ) : (
        <pre className="font-mono leading-relaxed">
          {parts.map((part, i) => {
            const cls = part.added
              ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200'
              : part.removed
                ? 'bg-red-100 text-red-900 line-through dark:bg-red-900/30 dark:text-red-200'
                : '';
            return (
              <span
                key={i}
                className={`block whitespace-pre-wrap break-words px-2 ${cls}`}
              >
                {part.value}
              </span>
            );
          })}
        </pre>
      )}
    </div>
  );
}
