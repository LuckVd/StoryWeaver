import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useChapterStore } from '@/stores/chapter-store';
import { ChapterEditor, countWords, getEditorHtml } from '@/components/editor/chapter-editor';
import { VersionPanel } from '@/components/editor/version-panel';
import { ChatPanel } from '@/components/chat/chat-panel';
import { StatusBadge } from '@/components/chapter/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, MessageSquare, History, CheckCircle, Send } from 'lucide-react';
import type { Editor } from '@tiptap/react';

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

  const handlePublish = async () => {
    if (!currentChapter) return;
    if (!window.confirm('定稿发布后章节将不可修改，确定继续？')) return;
    await updateChapterStatus(currentChapter.id, 'published');
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
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/chapters')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {isReadonly ? (
          <span className="text-lg font-semibold">{currentChapter.title}</span>
        ) : (
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            className="text-lg font-semibold"
            style={{ border: 'none', boxShadow: 'none', padding: '0 4px' }}
          />
        )}
        <StatusBadge status={currentChapter.status} />
        <span className="text-sm text-muted-foreground">{wordCount} 字</span>
        <div className="flex-1" />
        {!isReadonly && (
          <Button onClick={handleSave} disabled={!dirty || loading}>
            <Save className="mr-1 h-4 w-4" />
            {loading ? '保存中...' : '保存'}
          </Button>
        )}
        {currentChapter.status === 'draft' && !dirty && (
          <Button variant="outline" onClick={handleApprove} disabled={loading}>
            <CheckCircle className="mr-1 h-4 w-4" />
            提交审阅
          </Button>
        )}
        {currentChapter.status === 'approved' && (
          <Button variant="outline" onClick={handlePublish} disabled={loading}>
            <Send className="mr-1 h-4 w-4" />
            定稿发布
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
          <div className="w-[400px] shrink-0 border-l">
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
    </div>
  );
}
