import { RelationGraph } from '@/components/knowledge/relation-graph';

export function KnowledgePage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b px-6 py-3">
        <h1 className="text-lg font-semibold">知识库 · 关系图</h1>
      </div>
      <div className="flex-1">
        <RelationGraph />
      </div>
    </div>
  );
}
