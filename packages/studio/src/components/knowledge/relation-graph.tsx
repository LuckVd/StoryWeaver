import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useKnowledgeStore, type GraphEntity } from '@/stores/knowledge-store';
import type { RelationEdge } from '@storyweaver/core';
import { Plus } from 'lucide-react';

/** 实体类型颜色映射 */
const typeColors: Record<GraphEntity['type'], string> = {
  character: '#3b82f6',
  world: '#8b5cf6',
  item: '#f59e0b',
  hook: '#10b981',
  rule: '#6b7280',
};

const typeLabels: Record<GraphEntity['type'], string> = {
  character: '角色',
  world: '世界观',
  item: '物品',
  hook: '伏笔',
  rule: '规则',
};

/** 自定义节点 */
function EntityNode({ data }: { data: { label: string; entityType: GraphEntity['type'] } }) {
  const color = typeColors[data.entityType] ?? '#6b7280';
  return (
    <div
      className="rounded-lg border-2 bg-white px-3 py-2 shadow-md"
      style={{ borderColor: color }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium">{data.label}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-gray-400">{typeLabels[data.entityType]}</div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  entity: EntityNode,
};

/** 将实体转为 React Flow 节点 */
function entitiesToNodes(entities: GraphEntity[]): Node[] {
  // 环形布局
  const count = entities.length;
  const radius = Math.max(200, count * 30);
  const cx = 400;
  const cy = 300;

  return entities.map((e, i) => {
    const angle = (2 * Math.PI * i) / count;
    return {
      id: e.id,
      type: 'entity',
      position: { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) },
      data: { label: e.name, entityType: e.type },
    };
  });
}

/** 将 RelationEdge 转为 React Flow 边 */
function relationsToEdges(relations: RelationEdge[]): Edge[] {
  return relations.map((r) => ({
    id: r.id,
    source: r.from,
    target: r.to,
    label: r.type,
    animated: r.direction === 'directed',
    style: { stroke: '#64748b' },
    labelStyle: { fill: '#334155', fontSize: 11 },
    labelBgStyle: { fill: '#fff', fillOpacity: 0.8 },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 4,
  }));
}

export function RelationGraph() {
  const { entities, relations, fetchAll, addRelation, removeRelation } = useKnowledgeStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [showForm, setShowForm] = useState(false);
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [formType, setFormType] = useState('');
  const [formDirection, setFormDirection] = useState<'mutual' | 'directed'>('mutual');

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 同步 store → React Flow
  useEffect(() => {
    setNodes(entitiesToNodes(entities));
  }, [entities, setNodes]);

  useEffect(() => {
    setEdges(relationsToEdges(relations));
  }, [relations, setEdges]);

  // 删除边时同步到后端
  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      for (const change of changes) {
        if (change.type === 'remove') {
          removeRelation(change.id);
        }
      }
    },
    [onEdgesChange, removeRelation],
  );

  const handleAddRelation = useCallback(async () => {
    if (!formFrom || !formTo || !formType) return;
    await addRelation({
      from: formFrom,
      to: formTo,
      type: formType,
      direction: formDirection,
    });
    setShowForm(false);
    setFormFrom('');
    setFormTo('');
    setFormType('');
    setFormDirection('mutual');
  }, [formFrom, formTo, formType, formDirection, addRelation]);

  const minimapNodeColor = useCallback((node: Node) => {
    const entityType = (node.data as { entityType?: string })?.entityType;
    if (entityType && entityType in typeColors) {
      return typeColors[entityType as GraphEntity['type']];
    }
    return '#6b7280';
  }, []);

  const isEmpty = entities.length === 0 && relations.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">暂无知识库数据</p>
          <p className="mt-1 text-sm">请先在知识库中添加角色、物品等实体</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          添加关系
        </button>
        <button
          onClick={() => fetchAll()}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          刷新
        </button>
        {entities.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {entities.length} 个实体 · {relations.length} 条关系
          </span>
        )}
      </div>

      {/* 添加关系表单 */}
      {showForm && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-4 py-2">
          <select
            value={formFrom}
            onChange={(e) => setFormFrom(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="">起始实体</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">→</span>
          <select
            value={formTo}
            onChange={(e) => setFormTo(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="">目标实体</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <input
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            placeholder="关系类型（如：师徒）"
            className="w-36 rounded-md border bg-background px-2 py-1 text-sm"
          />
          <select
            value={formDirection}
            onChange={(e) => setFormDirection(e.target.value as 'mutual' | 'directed')}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="mutual">双向</option>
            <option value="directed">单向</option>
          </select>
          <button
            onClick={handleAddRelation}
            disabled={!formFrom || !formTo || !formType}
            className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            确认
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="rounded-md border px-3 py-1 text-sm hover:bg-accent"
          >
            取消
          </button>
        </div>
      )}

      {/* 图例 */}
      <div className="flex items-center gap-3 border-b px-4 py-1.5">
        {Object.entries(typeLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1 text-xs text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: typeColors[key as GraphEntity['type']] }}
            />
            {label}
          </div>
        ))}
      </div>

      {/* React Flow 画布 */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange as OnNodesChange}
          onEdgesChange={handleEdgesChange as OnEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-50"
        >
          <Background />
          <Controls />
          <MiniMap nodeColor={minimapNodeColor} pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  );
}
