import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import type { OutlineNode } from '@storyweaver/core';

/** 树状辅助函数 */
function findNode(node: OutlineNode, id: string | null): OutlineNode | null {
  if (!id) return null;
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const r = findNode(c, id);
    if (r) return r;
  }
  return null;
}
function patchNode(node: OutlineNode, id: string, patch: Partial<OutlineNode>): OutlineNode {
  if (node.id === id) return { ...node, ...patch };
  return {
    ...node,
    children: (node.children ?? []).map((c) => patchNode(c, id, patch)),
  };
}
function insertChild(node: OutlineNode, parentId: string, child: OutlineNode): OutlineNode {
  if (node.id === parentId) {
    return { ...node, children: [...(node.children ?? []), child] };
  }
  return {
    ...node,
    children: (node.children ?? []).map((c) => insertChild(c, parentId, child)),
  };
}
function removeFromTree(node: OutlineNode, id: string): OutlineNode {
  return {
    ...node,
    children: (node.children ?? [])
      .filter((c) => c.id !== id)
      .map((c) => removeFromTree(c, id)),
  };
}

/**
 * 大纲编辑器(G05-S04)
 *
 * 树状展示全书 > 卷 > 章节,支持编辑 title/summary、添加子节点、删除、
 * chapter 节点关联 chapterId(与正文章节联动)。整树保存到 knowledge/outline.json。
 */
export function OutlinePage() {
  const [tree, setTree] = useState<OutlineNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setTree(await api.get<OutlineNode | null>('/knowledge/outline'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!tree) return;
    setSaving(true);
    try {
      await api.put('/knowledge/outline', tree);
    } finally {
      setSaving(false);
    }
  };

  const ensureRoot = (): OutlineNode => {
    if (tree) return tree;
    const root: OutlineNode = {
      id: crypto.randomUUID(),
      type: 'book',
      title: '新书',
      sortOrder: 0,
    };
    setTree(root);
    setSelectedId(root.id);
    return root;
  };

  const updateNode = (id: string, patch: Partial<OutlineNode>) =>
    setTree((t) => (t ? patchNode(t, id, patch) : t));

  const addChild = (parentId: string, type: 'volume' | 'chapter') => {
    ensureRoot();
    const node: OutlineNode = {
      id: crypto.randomUUID(),
      type,
      title: type === 'volume' ? '新卷' : '新章节',
      sortOrder: Date.now(),
    };
    setTree((t) => (t ? insertChild(t, parentId, node) : insertChild(
      { id: parentId, type: 'book', title: '新书', sortOrder: 0 },
      parentId,
      node,
    )));
    setSelectedId(node.id);
  };

  const removeNode = (id: string) => {
    setTree((t) => (t ? (t.id === id ? null : removeFromTree(t, id)) : t));
    if (selectedId === id) setSelectedId(null);
  };

  if (loading) return <div className="p-6 text-muted-foreground">加载中…</div>;

  const selected = tree ? findNode(tree, selectedId) : null;

  return (
    <div className="flex h-full">
      <div className="w-2/3 overflow-auto border-r p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">大纲</h1>
          <button
            onClick={save}
            disabled={saving || !tree}
            className="rounded bg-primary px-3 py-1 text-primary-foreground"
          >
            {saving ? '保存中…' : '保存大纲'}
          </button>
        </div>
        {!tree ? (
          <button
            onClick={() => {
              const r = ensureRoot();
              setSelectedId(r.id);
            }}
            className="rounded border px-3 py-1"
          >
            创建大纲根节点
          </button>
        ) : (
          <NodeTree
            node={tree}
            depth={0}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
      </div>
      <div className="w-1/3 overflow-auto p-4">
        {selected ? (
          <NodeEditor
            node={selected}
            onChange={(patch) => updateNode(selected.id, patch)}
            onAddChild={(type) => addChild(selected.id, type)}
            onRemove={() => removeNode(selected.id)}
          />
        ) : (
          <div className="text-muted-foreground">选择左侧节点编辑,或创建大纲。</div>
        )}
      </div>
    </div>
  );
}

function NodeTree({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: OutlineNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div
        className={`cursor-pointer rounded px-2 py-1 ${selectedId === node.id ? 'bg-accent' : 'hover:bg-accent/50'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        <span className="mr-2 text-xs text-muted-foreground">
          {node.type === 'book' ? '📕' : node.type === 'volume' ? '📂' : '📄'}
        </span>
        <span className={node.type === 'book' ? 'font-semibold' : ''}>{node.title || '(无标题)'}</span>
        {node.chapterId != null && (
          <span className="ml-2 text-xs text-muted-foreground">→ 第{node.chapterId}章</span>
        )}
      </div>
      {(node.children ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => (
          <NodeTree
            key={c.id}
            node={c}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

function NodeEditor({
  node,
  onChange,
  onAddChild,
  onRemove,
}: {
  node: OutlineNode;
  onChange: (patch: Partial<OutlineNode>) => void;
  onAddChild: (type: 'volume' | 'chapter') => void;
  onRemove: () => void;
}) {
  const canHaveChildren = node.type === 'book' || node.type === 'volume';
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">
        编辑{node.type === 'book' ? '书籍' : node.type === 'volume' ? '卷' : '章节'}
      </h2>
      <label className="block text-sm">
        <span className="text-muted-foreground">标题</span>
        <input
          className="mt-1 w-full rounded border px-2 py-1"
          value={node.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">概要</span>
        <textarea
          className="mt-1 h-32 w-full rounded border px-2 py-1"
          value={node.summary ?? ''}
          onChange={(e) => onChange({ summary: e.target.value })}
        />
      </label>
      {node.type === 'chapter' && (
        <label className="block text-sm">
          <span className="text-muted-foreground">关联章节 ID</span>
          <input
            type="number"
            className="mt-1 w-full rounded border px-2 py-1"
            value={node.chapterId ?? ''}
            onChange={(e) =>
              onChange({ chapterId: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {canHaveChildren && (
          <>
            {node.type === 'book' && (
              <button onClick={() => onAddChild('volume')} className="rounded border px-2 py-1 text-sm">
                + 添加卷
              </button>
            )}
            <button onClick={() => onAddChild('chapter')} className="rounded border px-2 py-1 text-sm">
              + 添加章节节点
            </button>
          </>
        )}
        {node.type !== 'book' && (
          <button onClick={onRemove} className="rounded border px-2 py-1 text-sm text-red-600">
            删除节点
          </button>
        )}
      </div>
    </div>
  );
}
