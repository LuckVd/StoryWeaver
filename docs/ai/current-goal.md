# Current Goal

## Goal

G02-S02 — 关系图 + 可视化：邻接表存储 + React Flow 前端

## 背景

后端已完整：`RelationStorage`（CRUD）、`RelationEdge` 模型、API 路由（`/api/v1/knowledge/relations`）、Zod 校验、测试均已就绪。本子目标仅实现前端部分。

## 验收标准

1. 安装 `@xyflow/react` 到 `@storyweaver/studio`
2. 新增 `/knowledge` 页面，使用 React Flow 渲染关系图
3. 节点代表知识库实体（角色/物品等），边代表 RelationEdge
4. 支持从后端加载 relations 和 entities 并渲染为图
5. 支持在图上新建关系（边），通过 API 持久化
6. 支持删除关系（边）
7. 侧边栏添加「知识库」导航入口
8. `pnpm build` 零错误，`pnpm test` 全部通过

## 文件清单

### 新建
- `packages/studio/src/pages/knowledge.tsx` — 知识库关系图页面
- `packages/studio/src/components/knowledge/relation-graph.tsx` — React Flow 图组件
- `packages/studio/src/stores/knowledge-store.ts` — Zustand store

### 修改
- `packages/studio/src/App.tsx` — 添加 `/knowledge` 路由
- `packages/studio/src/components/layout/sidebar.tsx` — 添加知识库导航
- `packages/studio/package.json` — 添加 `@xyflow/react` 依赖

## 实现要点

### 1. 安装依赖

```bash
pnpm --filter @storyweaver/studio add @xyflow/react
```

### 2. knowledge-store.ts

Zustand store，提供：
- `characters: Character[]` — 从 `/api/v1/knowledge/characters` 加载
- `relations: RelationEdge[]` — 从 `/api/v1/knowledge/relations` 加载
- `fetchData()` — 并行加载 characters + relations
- `addRelation(data)` — POST 创建关系
- `removeRelation(id)` — DELETE 删除关系

### 3. relation-graph.tsx

React Flow 组件：
- 将 `characters` 转为节点（每个角色一个节点，label=名字）
- 将 `relations` 转为自定义边（label=关系类型，animated=directed）
- 使用 `useNodesState` / `useEdgesState` 管理状态
- 支持 `onEdgesChange` 中的删除操作
- 提供「添加关系」按钮（简易表单：选择 from/to/type）

### 4. knowledge.tsx 页面

- 全屏布局，上方工具栏（刷新、添加关系），主体为 RelationGraph
- 加载状态 + 空状态提示

### 5. 路由 + 导航

- App.tsx 添加 `{ path: 'knowledge', element: <KnowledgePage /> }`
- sidebar 添加 `{ to: '/knowledge', label: '知识库', icon: Network }`（使用 lucide-react 的 Network 图标）

## 测试计划

- 前端测试暂不新增（本阶段重点为可视化功能验证）
- 确保 `pnpm build` 和 `pnpm test` 通过

## Steps

1. **安装 @xyflow/react**
2. **创建 knowledge-store.ts** — Zustand store
3. **创建 relation-graph.tsx** — React Flow 图组件
4. **创建 knowledge.tsx** — 页面组件
5. **更新路由和侧边栏**
6. **构建验证** — `pnpm build` + `pnpm test`

## Parent Goal

- G02 — Phase 2: 核心流水线 (roadmap) → **in progress**（9/10 完成，仅剩本子目标）
