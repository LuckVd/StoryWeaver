import type { ReviewIssue, IssueSeverity } from '@storyweaver/core';

const severityConfig: Record<IssueSeverity, { label: string; color: string; bg: string }> = {
  high: { label: '严重', color: 'text-red-600', bg: 'bg-red-100' },
  medium: { label: '中等', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  low: { label: '轻微', color: 'text-gray-500', bg: 'bg-gray-100' },
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
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color} ${cfg.bg}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-muted-foreground">{items.length} 项</span>
            </div>
            <div className="space-y-2">
              {items.map((issue, idx) => (
                <div key={idx} className="rounded-lg border p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-xs bg-muted">
                      {dimensionLabels[issue.dimension] ?? issue.dimension}
                    </span>
                    {issue.location && (
                      <span className="text-xs text-muted-foreground">
                        {issue.location}
                      </span>
                    )}
                  </div>
                  <div>{issue.description}</div>
                  {issue.suggestion && (
                    <div className="text-muted-foreground">
                      建议：{issue.suggestion}
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
