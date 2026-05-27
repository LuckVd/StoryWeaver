import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useChapterStore } from '@/stores/chapter-store';
import { ChapterEditor, countWords, getEditorHtml } from '@/components/editor/chapter-editor';
import { StatusBadge } from '@/components/chapter/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save } from 'lucide-react';
import type { Editor } from '@tiptap/react';

export function ChapterEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentChapter, loading, error, fetchChapter, saveChapter } = useChapterStore();
  const [title, setTitle] = useState('');
  const [dirty, setDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const editorRef = useRef<Editor | null>(null);

  const chapterId = Number(id);

  useEffect(() => {
    if (chapterId > 0) {
      fetchChapter(chapterId);
    }
  }, [chapterId, fetchChapter]);

  useEffect(() => {
    if (currentChapter) {
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

  if (error) {
    return <div className="flex h-full items-center justify-center text-destructive">{error}</div>;
  }

  if (loading && !currentChapter) {
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
      </div>

      {/* 编辑器 */}
      <div className="flex-1 overflow-auto p-6">
        <ChapterEditor
          content={currentChapter.content}
          editable={!isReadonly}
          onUpdate={handleEditorUpdate}
        />
      </div>
    </div>
  );
}
