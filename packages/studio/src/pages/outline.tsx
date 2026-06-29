import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { useBookStore } from '@/stores/book-store';
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
 * book 根自动创建、UI 隐藏;界面直接平铺各剧情卷(arc)及其大事件(milestone)。
 * arc 标注覆盖章节范围 [起, 止?]:结束章留空=进行中;设某卷起始章时,若上一卷开放
 * (无结束章)且有起始,自动把上一卷结束章回填为「本卷起始−1」。整树存 knowledge/outline.json。
 */
export function OutlinePage() {
  const { book } = useBookStore();
  const [tree, setTree] = useState<OutlineNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const t = await api.get<OutlineNode | null>('/knowledge/outline');
      // 无大纲 → 自动建 book 根(隐藏的结构容器),标题用书名
      setTree(
        t ?? {
          id: crypto.randomUUID(),
          type: 'book',
          title: book?.title ?? '大纲',
          sortOrder: 0,
        },
      );
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

  const updateNode = (id: string, patch: Partial<OutlineNode>) =>
    setTree((t) => (t ? patchNode(t, id, patch) : t));

  /** 设某卷起始章;若上一卷(兄弟)开放(无结束章)且有起始,自动回填其结束章=起始−1 */
  const setArcStart = (arcId: string, start: number | undefined) =>
    setTree((t) => {
      if (!t) return t;
      const arcs = [...(t.children ?? [])];
      const idx = arcs.findIndex((a) => a.id === arcId);
      if (idx === -1) return t;
      const cur = arcs[idx];
      const end = cur.chapterRange?.[1];
      // 本卷:清空起始 → 无范围(不可定位);否则设起始,有结束则保留、无结束则开放([start])
      arcs[idx] =
        start == null
          ? { ...cur, chapterRange: undefined }
          : { ...cur, chapterRange: end == null ? [start] : [start, end] };
      // 回填上一卷:开放(无结束)且有起始 → 结束 = start−1
      if (start != null && idx > 0) {
        const prev = arcs[idx - 1];
        if (
          prev.type === 'arc' &&
          prev.chapterRange?.[0] != null &&
          prev.chapterRange?.[1] == null
        ) {
          arcs[idx - 1] = { ...prev, chapterRange: [prev.chapterRange[0], start - 1] };
        }
      }
      return { ...t, children: arcs };
    });

  const addChild = (parentId: string, type: 'arc' | 'milestone') => {
    const node: OutlineNode = {
      id: crypto.randomUUID(),
      type,
      title: type === 'arc' ? '新卷' : '新大事件',
      sortOrder: Date.now(),
    };
    setTree((t) => (t ? insertChild(t, parentId, node) : t));
    setSelectedId(node.id);
  };

  const removeNode = (id: string) => {
    setTree((t) => (t ? removeFromTree(t, id) : t)); // book 根隐藏、不可选,不会被删
    if (selectedId === id) setSelectedId(null);
  };

  if (loading) return <div className="p-6 text-muted-foreground">加载中…</div>;

  const arcs = (tree?.children ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const selected = tree ? findNode(tree, selectedId) : null;

  return (
    <div className="flex h-full">
      <div className="w-2/3 overflow-auto border-r p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">大纲</h1>
          <div className="flex gap-2">
            <button
              onClick={() => tree && addChild(tree.id, 'arc')}
              disabled={!tree}
              className="rounded border px-3 py-1 text-sm"
            >
              + 添加卷
            </button>
            <button
              onClick={save}
              disabled={saving || !tree}
              className="rounded bg-primary px-3 py-1 text-primary-foreground"
            >
              {saving ? '保存中…' : '保存大纲'}
            </button>
          </div>
        </div>
        {arcs.length === 0 ? (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            暂无剧情卷。点上方「+ 添加卷」开始规划剧情方向。
          </div>
        ) : (
          arcs.map((arc) => (
            <NodeTree
              key={arc.id}
              node={arc}
              depth={0}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ))
        )}
      </div>
      <div className="w-1/3 overflow-auto p-4">
        {selected ? (
          <NodeEditor
            node={selected}
            onChange={(patch) => updateNode(selected.id, patch)}
            onSetArcStart={(start) => setArcStart(selected.id, start)}
            onAddChild={(type) => addChild(selected.id, type)}
            onRemove={() => removeNode(selected.id)}
          />
        ) : (
          <div className="text-muted-foreground">选择左侧节点编辑。</div>
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
  const rangeLabel =
    node.type === 'arc'
      ? !node.chapterRange
        ? '(未定章)'
        : node.chapterRange[1] == null
          ? `[第${node.chapterRange[0]}- 进行中]`
          : `[第${node.chapterRange[0]}-${node.chapterRange[1]}章]`
      : null;
  return (
    <div>
      <div
        className={`cursor-pointer rounded px-2 py-1 ${selectedId === node.id ? 'bg-accent' : 'hover:bg-accent/50'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        <span className="mr-2 text-xs text-muted-foreground">
          {node.type === 'arc' ? '⛰️' : '🔶'}
        </span>
        <span>{node.title || '(无标题)'}</span>
        {rangeLabel && <span className="ml-2 text-xs text-muted-foreground">{rangeLabel}</span>}
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
  onSetArcStart,
  onAddChild,
  onRemove,
}: {
  node: OutlineNode;
  onChange: (patch: Partial<OutlineNode>) => void;
  onSetArcStart?: (start: number | undefined) => void;
  onAddChild: (type: 'arc' | 'milestone') => void;
  onRemove: () => void;
}) {
  const summaryHint =
    node.type === 'arc' ? '本卷方向(目标/冲突/走向,AI 写作时据此把控剧情)' : '该大事件要点';
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">编辑{node.type === 'arc' ? '剧情卷' : '大事件'}</h2>
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
        <div className="block text-sm">
          <span className="text-muted-foreground">覆盖章节范围(AI 据当前章定位当前卷)</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              className="w-full rounded border px-2 py-1"
              placeholder="起始章"
              value={node.chapterRange?.[0] ?? ''}
              onChange={(e) =>
                onSetArcStart?.(e.target.value ? Number(e.target.value) : undefined)
              }
            />
            <input
              type="number"
              className="w-full rounded border px-2 py-1"
              placeholder="进行中…"
              value={node.chapterRange?.[1] ?? ''}
              onChange={(e) => {
                const s = node.chapterRange?.[0] ?? 0;
                onChange({
                  chapterRange: (
                    e.target.value ? [s, Number(e.target.value)] : [s]
                  ) as [number, number?],
                });
              }}
            />
          </div>
          <span className="mt-1 block text-xs text-muted-foreground">
            起始章必填;结束章留空 = 本卷进行中(新增下一卷时自动回填为「其起始−1」)。未来卷可不填范围(纯方向规划,AI 会作为「后续规划」参考)。
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {node.type === 'arc' && (
          <button
            onClick={() => onAddChild('milestone')}
            className="rounded border px-2 py-1 text-sm"
          >
            + 添加大事件
          </button>
        )}
        <button onClick={onRemove} className="rounded border px-2 py-1 text-sm text-destructive">
          删除节点
        </button>
      </div>
    </div>
  );
}
