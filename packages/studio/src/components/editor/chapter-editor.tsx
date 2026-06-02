import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import type { Editor } from '@tiptap/react';

interface ChapterEditorProps {
  content: string;
  editable: boolean;
  onUpdate?: (editor: Editor) => void;
}

export function ChapterEditor({ content, editable, onUpdate }: ChapterEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '开始写作...',
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate?.(editor);
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div className="prose prose-sm max-w-none rounded-md border p-4">
      <EditorContent editor={editor} />
    </div>
  );
}

export function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, '').trim();
  if (!text) return 0;
  return text.length;
}

export function getEditorHtml(editor: Editor): string {
  return editor.getHTML();
}
