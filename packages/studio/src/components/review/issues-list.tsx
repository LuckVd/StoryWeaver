import type { ReviewIssue, IssueSeverity } from '@storyweaver/core';
import { Seal } from '@/components/ui/seal';
import { VermilionMark } from '@/components/ui/vermilion-mark';

const severityConfig: Record<IssueSeverity, { label: string; glyph: string; filled: boolean; text: string }> = {
  // 朱批墨韵:严重度用印章标记,朱砂 = AI 标出的问题
  high: { label: '严重', glyph: '◆', filled: true, text: 'text-vermilion' },
  medium: { label: '中等', glyph: '◇', filled: false, text: 'text-vermilion/80' },
  low: { label: '轻微', glyph: '○', filled: false, text: 'text-muted-foreground' },
};

const dimensionLabels: Record<string, string> = {
  character_consistency: '人设',
  timeline: '时间线',
  worldview: '世界观',
  hooks: '伏笔',
  pacing: '节奏',
  style: '风格',
  length: '篇幅',
};

export function IssuesList({ issues }: { issues: ReviewIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        未发现问题
      </div>
    );
  }

  const grouped = {
    high: issues.filter((i) => i.severity === 'high'),
    medium: issues.filter((i) => i.severity === 'medium'),
    low: issues.filter((i) => i.severity === 'low'),
  };

  return (
    <div className="space-y-4">
      {(['high', 'medium', 'low'] as const).map((severity) => {
        const items = grouped[severity];
        if (items.length === 0) return null;
        const cfg = severityConfig[severity];
        return (
          <div key={severity}>
            <div className="mb-2 flex items-center gap-2">
              <Seal variant={cfg.filled ? 'filled' : 'outline'} className="h-5 w-5 text-[0.6rem] [transform:none]">{cfg.glyph}</Seal>
              <span className={`font-heading text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
              <span className="font-heading text-xs text-muted-foreground">{items.length} 项</span>
            </div>
            <div className="space-y-2">
              {items.map((issue, idx) => (
                <div key={idx} className="rounded-lg border border-l-2 border-l-vermilion/40 p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-heading text-xs">
                      {dimensionLabels[issue.dimension] ?? issue.dimension}
                    </span>
                    {issue.location && (
                      <VermilionMark className="text-xs text-muted-foreground">
                        {issue.location}
                      </VermilionMark>
                    )}
                  </div>
                  <div>{issue.description}</div>
                  {issue.suggestion && (
                    <div className="flex gap-1.5 text-muted-foreground">
                      <Seal className="mt-0.5 h-4 w-4 shrink-0 text-[0.5rem] [transform:none]">朱</Seal>
                      <span>{issue.suggestion}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
