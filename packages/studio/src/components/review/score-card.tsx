import type { ReviewReport, ReviewScore } from '@storyweaver/core';

const dimensionLabels: Record<string, string> = {
  character_consistency: '人设一致性',
  timeline: '时间线',
  worldview: '世界观',
  hooks: '伏笔管理',
  pacing: '节奏控制',
  style: '风格一致',
  length: '篇幅控制',
};

function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-500';
  if (score >= 5) return 'text-yellow-500';
  return 'text-red-500';
}

function scoreBarColor(score: number): string {
  if (score >= 8) return 'bg-green-500';
  if (score >= 5) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function ScoreCard({ report }: { report: ReviewReport }) {
  return (
    <div className="space-y-6">
      {/* 综合评分 */}
      <div className="flex items-center gap-6">
        <div className={`text-5xl font-bold ${scoreColor(report.overallScore)}`}>
          {report.overallScore.toFixed(1)}
        </div>
        <div className="text-sm text-muted-foreground">
          <div>综合评分</div>
          <div>{report.scores.length} 个维度 · {report.issues.length} 个问题</div>
        </div>
      </div>

      {/* 维度评分条 */}
      <div className="space-y-3">
        {report.scores.map((s: ReviewScore) => (
          <div key={s.dimension} className="flex items-center gap-3 text-sm">
            <div className="w-20 shrink-0 text-muted-foreground">
              {dimensionLabels[s.dimension] ?? s.dimension}
            </div>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${scoreBarColor(s.score)}`}
                style={{ width: `${s.score * 10}%` }}
              />
            </div>
            <div className={`w-8 text-right font-medium ${scoreColor(s.score)}`}>
              {s.score}
            </div>
          </div>
        ))}
      </div>

      {/* 审稿总结 */}
      {report.summary && (
        <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          {report.summary}
        </div>
      )}
    </div>
  );
}
