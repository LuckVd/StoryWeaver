import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useChapterStore } from '@/stores/chapter-store';
import { ChapterEditor, countWords, getEditorHtml } from '@/components/editor/chapter-editor';
import { VersionPanel } from '@/components/editor/version-panel';
import { ChatPanel } from '@/components/chat/chat-panel';
import { StatusBadge } from '@/components/chapter/status-badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, MessageSquare, History, CheckCircle, Send, RotateCcw, RefreshCw } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { api } from '@/lib/api-client';
import type { ChapterSummary } from '@storyweaver/core';

export function ChapterEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentChapter, loading, error, fetchChapter, saveChapter, updateChapterStatus } = useChapterStore();
  const [title, setTitle] = useState('');
  const [dirty, setDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const [summary, setSummary] = useState<ChapterSummary | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const chapterId = Number(id);

  useEffect(() => {
    if (chapterId > 0) {
      fetchChapter(chapterId);
    }
  }, [chapterId, fetchChapter]);

  useEffect(() => {
    if (currentChapter) {
      // AI apply 时只更新内容，不重置编辑器状态
      if ((window as unknown as Record<string, unknown>).__skipEditorReset) {
        (window as unknown as Record<string, unknown>).__skipEditorReset = false;
        setWordCount(countWords(currentChapter.content));
        return;
      }
      setTitle(currentChapter.title);
      setDirty(false);
      setWordCount(countWords(currentChapter.content));
    }
  }, [currentChapter]);

  // 已发布章节加载摘要 + 生成状态（后端持久化，切换 tab/刷新都看得到）
  useEffect(() => {
    if (currentChapter?.status === 'published') {
      api
        .get<{ summary: ChapterSummary | null; generating: boolean }>(`/chapters/${chapterId}/summary`)
        .then((res) => {
          setSummary(res.summary);
          setGeneratingSummary(res.generating);
        })
        .catch(() => {});
    } else {
      setSummary(null);
      setGeneratingSummary(false);
    }
  }, [currentChapter?.status, chapterId]);

  // 生成中时轮询（状态在后端，跨组件/刷新持久）
  useEffect(() => {
    if (!generatingSummary) return;
    const timer = setInterval(async () => {
      try {
        const res = await api.get<{ summary: ChapterSummary | null; generating: boolean }>(
          `/chapters/${chapterId}/summary`,
        );
        setSummary(res.summary);
        if (!res.generating) setGeneratingSummary(false);
      } catch {
        // 忽略
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [generatingSummary, chapterId]);

  const handleEditorUpdate = (editor: Editor) => {
    editorRef.current = editor;
    setDirty(true);
    setWordCount(countWords(editor.getHTML()));
  };

  const handleSave = async () => {
    if (!currentChapter) return;
    const content = editorRef.current ? getEditorHtml(editorRef.current) : currentChapter.content;
    await saveChapter(currentChapter.id, { title, content });
    setDirty(false);
  };

  const handleApprove = async () => {
    if (!currentChapter) return;
    await updateChapterStatus(currentChapter.id, 'approved');
  };

  const handleReview = async () => {
    if (!currentChapter) return;
    setReviewing(true);
    try {
      await api.post(`/chapters/${currentChapter.id}/review`, {});
      navigate(`/chapters/${currentChapter.id}/review`);
    } catch {
      // 审稿失败：API 错误已包含在响应中，此处静默
    } finally {
      setReviewing(false);
    }
  };

  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    danger?: boolean;
    action: () => Promise<void>;
  } | null>(null);

  const handlePublish = () => {
    if (!currentChapter) return;
    setConfirmState({
      title: '定稿发布',
      message: '定稿发布后章节将不可修改，确定继续？',
      action: () => updateChapterStatus(currentChapter.id, 'published'),
    });
  };

  // 危险操作：已发布章节回退草稿（占位保留，可清空重写；同步删除摘要）
  const handleRevertToDraft = () => {
    if (!currentChapter) return;
    setConfirmState({
      title: '回退草稿',
      message: '确定回退为草稿？将删除该章摘要，且需重新审阅/发布。\n章节占位保留，可清空重写。',
      danger: true,
      action: () => updateChapterStatus(currentChapter.id, 'draft'),
    });
  };

  const runConfirm = async () => {
    if (!confirmState) return;
    await confirmState.action();
    setConfirmState(null);
    // 发布后 currentChapter.status 变 published，上面的 summary useEffect 会自动加载生成状态并轮询
  };

  // currentChapter 是全局 zustand 状态，从其他章节跳转过来时会残留旧数据
  // 必须同时检查 id 是否匹配，否则会闪现旧章节内容
  const chapterReady = currentChapter?.id === chapterId;

  if (error) {
    return <div className="flex h-full items-center justify-center text-destructive">{error}</div>;
  }

  if (loading || !chapterReady) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">加载中...</div>;
  }

  if (!currentChapter) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">章节不存在</div>;
  }

  const isReadonly = currentChapter.status === 'published';

  return (
    <div className="flex h-full flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center gap-3 border-b bg-card/60 px-5 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/chapters')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {isReadonly ? (
          <span className="font-heading text-xl font-semibold">{currentChapter.title}</span>
        ) : (
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            className="max-w-xs font-heading text-xl font-semibold"
            style={{ border: 'none', boxShadow: 'none', padding: '0 4px' }}
          />
        )}
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={currentChapter.status} />
          <span className="whitespace-nowrap font-heading text-sm text-muted-foreground">{wordCount} 字</span>
          {generatingSummary && (
            <span className="flex items-center gap-1 text-xs text-vermilion">
              <RefreshCw className="h-3 w-3 animate-spin" /> 摘要生成中…
            </span>
          )}
        </div>
        <div className="flex-1" />
        {!isReadonly && (
          <Button onClick={handleSave} disabled={!dirty || loading}>
            <Save className="mr-1 h-4 w-4" />
            {loading ? '保存中...' : '保存'}
          </Button>
        )}
        {currentChapter.status === 'draft' && !dirty && (
          <>
            <Button variant="vermilion" onClick={handleReview} disabled={loading || reviewing}>
              <CheckCircle className="mr-1 h-4 w-4" />
              {reviewing ? '审稿中...' : '提交审阅'}
            </Button>
            <Button variant="outline" onClick={handleApprove} disabled={loading}>
              通过审阅
            </Button>
          </>
        )}
        {currentChapter.status === 'approved' && (
          <Button variant="outline" onClick={handlePublish} disabled={loading}>
            <Send className="mr-1 h-4 w-4" />
            定稿发布
          </Button>
        )}
        {currentChapter.status === 'published' && (
          <Button variant="outline" onClick={handleRevertToDraft} disabled={loading}>
            <RotateCcw className="mr-1 h-4 w-4" />
            回退草稿
          </Button>
        )}
        <Button
          variant={showChat ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setShowChat(!showChat)}
          title="AI 对话"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
        <Button
          variant={showVersions ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => setShowVersions(!showVersions)}
          title="版本历史"
        >
          <History className="h-4 w-4" />
        </Button>
      </div>

      {/* 内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 编辑器 */}
        <div className="flex-1 overflow-auto p-6">
          <ChapterEditor
            content={currentChapter.content}
            editable={!isReadonly}
            onUpdate={handleEditorUpdate}
          />
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="w-[400px] shrink-0 border-l bg-sidebar/40">
            <ChatPanel
              chapterId={chapterId}
              onClose={() => setShowChat(false)}
              embedded
            />
          </div>
        )}

        {/* Version Panel */}
        {showVersions && (
          <div className="w-[300px] shrink-0 border-l">
            <VersionPanel
              chapterId={chapterId}
              onClose={() => setShowVersions(false)}
            />
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        variant={confirmState?.danger ? 'danger' : 'default'}
        onConfirm={runConfirm}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
