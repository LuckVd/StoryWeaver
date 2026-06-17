import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { api } from '@/lib/api-client';
import { useChapterStore } from '@/stores/chapter-store';
import type { ReviewReport } from '@storyweaver/core';
import { ScoreCard } from '@/components/review/score-card';
import { IssuesList } from '@/components/review/issues-list';
import { DiffViewer } from '@/components/editor/diff-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const chapterOrder = useChapterStore((s) => s.chapterOrder);
  const fetchVolumesAndChapters = useChapterStore((s) => s.fetchVolumesAndChapters);
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchVolumesAndChapters();
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

  const handleApprove = async () => {
    await api.put(`/chapters/${id}/status`, { status: 'approved' });
    navigate(`/chapters/${id}`);
  };

  const [revising, setRevising] = useState(false);
  const [diff, setDiff] = useState<{ original: string; revised: string } | null>(null);

  const handleRevise = async () => {
    if (!id || !selected) return;
    setRevising(true);
    try {
      const result = await api.post<{ original: string; revised: string }>(
        `/chapters/${id}/revise`,
        { issues: selected.issues },
      );
      setDiff(result);
    } catch {
      // 静默
    } finally {
      setRevising(false);
    }
  };

  const handleAccept = async () => {
    if (!id || !diff) return;
    await api.put(`/chapters/${id}`, { content: diff.revised });
    setDiff(null);
    navigate(`/chapters/${id}`);
  };

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
          <p className="text-sm text-muted-foreground">第 {chapterOrder[Number(id)] ?? id} 章</p>
        </div>
        <div className="flex gap-2">
          {reports.length > 0 && (
            <Button onClick={handleApprove}>通过审阅</Button>
          )}
          <Button variant="outline" onClick={() => navigate(`/chapters/${id}`)}>
            返回编辑
          </Button>
        </div>
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
          <div className="mt-4">
            {!diff && (
              <Button onClick={handleRevise} disabled={revising}>
                {revising ? 'AI 修订中…（GLM 推理较慢）' : 'AI 一键修订'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 修订 diff 预览 */}
      {diff && (
        <Card>
          <CardHeader>
            <CardTitle>修订预览（接受后替换章节内容）</CardTitle>
          </CardHeader>
          <CardContent>
            <DiffViewer oldText={diff.original} newText={diff.revised} oldLabel="原文" newLabel="AI 修订" />
            <div className="mt-3 flex gap-2">
              <Button onClick={handleAccept}>接受修订</Button>
              <Button variant="outline" onClick={() => setDiff(null)}>
                放弃
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
