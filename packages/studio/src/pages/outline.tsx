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
 * 大纲编辑器(G05-S04)—— 剧情方向把控层
 *
 * 树状展示全书 > 剧情卷(arc) > 大事件(milestone),编辑 title/方向概要、
 * 添加子节点、删除;arc 标注覆盖章节范围 [起,止](供 AI 按当前章定位当前卷)。
 * 整树保存到 knowledge/outline.json。
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

  const addChild = (parentId: string, type: 'arc' | 'milestone') => {
    ensureRoot();
    const node: OutlineNode = {
      id: crypto.randomUUID(),
      type,
      title: type === 'arc' ? '新卷' : '新大事件',
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
          {node.type === 'book' ? '📕' : node.type === 'arc' ? '⛰️' : '🔶'}
        </span>
        <span className={node.type === 'book' ? 'font-semibold' : ''}>{node.title || '(无标题)'}</span>
        {node.type === 'arc' && node.chapterRange && (
          <span className="ml-2 text-xs text-muted-foreground">
            [第{node.chapterRange[0]}-{node.chapterRange[1]}章]
          </span>
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
  onAddChild: (type: 'arc' | 'milestone') => void;
  onRemove: () => void;
}) {
  const canHaveChildren = node.type === 'book' || node.type === 'arc';
  const summaryHint =
    node.type === 'arc' ? '本卷方向(目标/冲突/走向,AI 写作时据此把控剧情)' : '该大事件要点';
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">
        编辑{node.type === 'book' ? '书籍' : node.type === 'arc' ? '剧情卷' : '大事件'}
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
        <span className="text-muted-foreground">概要 · {summaryHint}</span>
        <textarea
          className="mt-1 h-32 w-full rounded border px-2 py-1"
          value={node.summary ?? ''}
          onChange={(e) => onChange({ summary: e.target.value })}
        />
      </label>
      {node.type === 'arc' && (
        <label className="block text-sm">
          <span className="text-muted-foreground">覆盖章节范围 [起 - 止](AI 据当前章定位当前卷)</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              className="w-full rounded border px-2 py-1"
              placeholder="起始章"
              value={node.chapterRange?.[0] ?? ''}
              onChange={(e) =>
                onChange({
                  chapterRange: [
                    e.target.value ? Number(e.target.value) : 0,
                    node.chapterRange?.[1] ?? 0,
                  ],
                })
              }
            />
            <input
              type="number"
              className="w-full rounded border px-2 py-1"
              placeholder="结束章"
              value={node.chapterRange?.[1] ?? ''}
              onChange={(e) =>
                onChange({
                  chapterRange: [
                    node.chapterRange?.[0] ?? 0,
                    e.target.value ? Number(e.target.value) : 0,
                  ],
                })
              }
            />
          </div>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {canHaveChildren && (
          <button
            onClick={() => onAddChild(node.type === 'book' ? 'arc' : 'milestone')}
            className="rounded border px-2 py-1 text-sm"
          >
            + 添加{node.type === 'book' ? '卷' : '大事件'}
          </button>
        )}
        {node.type !== 'book' && (
          <button onClick={onRemove} className="rounded border px-2 py-1 text-sm text-destructive">
            删除节点
          </button>
        )}
      </div>
    </div>
  );
}
