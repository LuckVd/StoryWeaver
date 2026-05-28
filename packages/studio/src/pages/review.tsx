import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { api } from '@/lib/api-client';
import type { ReviewReport } from '@storyweaver/core';
import { ScoreCard } from '@/components/review/score-card';
import { IssuesList } from '@/components/review/issues-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<ReviewReport[]>(`/chapters/${id}/reviews`)
      .then((data) => {
        setReports(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={() => navigate(`/chapters/${id}`)}>返回章节</Button>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <p>暂无审稿报告</p>
        <p className="text-sm">在对话中使用"审稿"指令触发 AI 审稿</p>
        <Button variant="outline" onClick={() => navigate(`/chapters/${id}`)}>返回章节</Button>
      </div>
    );
  }

  const selected = reports[selectedIdx];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">审稿报告</h1>
          <p className="text-sm text-muted-foreground">第 {id} 章</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/chapters/${id}`)}>
          返回编辑
        </Button>
      </div>

      {/* 历史报告切换 */}
      {reports.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {reports.map((r, idx) => (
            <button
              key={r.id}
              onClick={() => setSelectedIdx(idx)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                idx === selectedIdx
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border hover:bg-muted'
              }`}
            >
              {new Date(r.createdAt).toLocaleString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              <span className="ml-1.5 font-medium">{r.overallScore.toFixed(1)}</span>
            </button>
          ))}
        </div>
      )}

      {/* 评分卡 */}
      <Card>
        <CardHeader>
          <CardTitle>评分</CardTitle>
        </CardHeader>
        <CardContent>
          <ScoreCard report={selected} />
        </CardContent>
      </Card>

      {/* 问题列表 */}
      <Card>
        <CardHeader>
          <CardTitle>问题 ({selected.issues.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <IssuesList issues={selected.issues} />
        </CardContent>
      </Card>
    </div>
  );
}
