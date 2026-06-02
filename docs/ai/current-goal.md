# Current Goal

## Goal

G02-S11 — 知识库前端管理 UI：为角色/世界观/物品/伏笔/规则/自定义提供完整的 CRUD 界面

## 背景

G02-S01（知识库后端）和 G02-S02（关系图可视化）均已完成，但前端只有关系图页面，缺少知识库实体的创建/编辑/删除入口。后端 API 完整支持 6 种实体的 CRUD，前端需要补齐对应的 UI。

## 验收标准

1. `/knowledge` 页面改为 Tab 布局：角色 | 世界观 | 物品 | 伏笔 | 规则 | 自定义 | 关系图
2. 每个实体 Tab 提供：列表展示 + 新建按钮 + 编辑/删除操作
3. 世界观 Tab 内按子分类（地理/力量体系/势力/历史/术语）再分 Tab
4. 自定义 Tab 内按用户创建的分类名再分 Tab
5. 关联字段（物品 owner、伏笔 relatedEntities）使用下拉选择 + 模糊搜索
6. 新建/编辑使用 Dialog 表单，字段对齐后端 Zod schema
7. 关系图保留为最后一个 Tab，功能不变
8. 各实体从后端 API 加载，增删改通过 API 持久化
9. `pnpm build` 零错误，`pnpm test` 全部通过

## 文件清单

### 新建
- `packages/studio/src/components/knowledge/entity-list.tsx` — 通用实体列表组件
- `packages/studio/src/components/knowledge/entity-form-dialog.tsx` — 通用实体表单 Dialog（含 entity-select 模糊搜索字段）
- `packages/studio/src/stores/knowledge-store.ts` — 扩展现有 store，增加各实体的 CRUD actions

### 修改
- `packages/studio/src/pages/knowledge.tsx` — 改为 Tab 布局，集成各实体 Tab
- `packages/studio/src/components/knowledge/relation-graph.tsx` — 移除页面级包装，仅保留图组件本身

## 实现要点

### 1. knowledge-store.ts 扩展

在现有 `fetchAll` / `addRelation` / `removeRelation` 基础上，新增各实体的独立 CRUD：

```
characters: Character[] + fetchCharacters() + createCharacter() + updateCharacter() + deleteCharacter()
worldEntries: WorldEntry[] + fetchWorld() + createWorld() + updateWorld() + deleteWorld()
items: Item[] + fetchItems() + createItem() + updateItem() + deleteItem()
hooks: Hook[] + fetchHooks() + createHook() + updateHook() + deleteHook()
rules: Rule[] + fetchRules() + createRule() + updateRule() + deleteRule()
customCategories: string[] + customEntries: Record<string, CustomKnowledge[]> + fetchCustomCategories() + fetchCustom(name) + createCustom() + updateCustom() + deleteCustom()
```

各 fetch 方法在页面 Tab 切换时按需调用（懒加载），避免一次性加载所有数据。

### 2. entity-list.tsx — 通用实体列表

接收泛型配置：
- `columns: { key, label, render? }[]` — 列定义
- `data: T[]` — 数据
- `onEdit: (item: T) => void`
- `onDelete: (id: string) => void`
- `onCreate: () => void`
- `loading` / `emptyText`

### 3. entity-form-dialog.tsx — 通用表单 Dialog

接收泛型配置：
- `fields: FieldDef[]` — 字段定义（name, label, type: text|textarea|select|entitySelect|number, required, options?）
- `values: Record<string, unknown>` — 初始值（编辑时传入）
- `onSubmit: (values) => void`
- `open` / `onClose` / `title` / `loading`

新增 `entitySelect` 字段类型：从已有实体列表（如角色）中下拉选择，支持模糊搜索。

### 4. knowledge.tsx — Tab 布局

7 个 Tab：角色 | 世界观 | 物品 | 伏笔 | 规则 | 自定义 | 关系图

- **世界观 Tab**：顶部再加子 Tab（全部 | 地理 | 力量体系 | 势力 | 历史 | 术语），切换时过滤列表
- **自定义 Tab**：顶部按已有分类名动态生成子 Tab，提供"新建分类"入口
- 每个实体 Tab 渲染 `<EntityList>` + `<EntityFormDialog>`
- 关系图 Tab 直接渲染 `<RelationGraph />`

### 5. 实体字段配置（对齐 Zod Schema）

**角色 Character**：
- name (text, 必填) | aliases (text, placeholder "别名1,别名2") | description (textarea, 必填) | profile (textarea) | firstAppearance (number) | tags (text, placeholder "标签1,标签2")

**世界观 WorldEntry**：
- category (select: geography/power-system/factions/history/glossary, 必填, 仅创建时可编辑) | name (text, 必填) | content (textarea, 必填) | tags (text)

**物品 Item**：
- name (text, 必填) | description (textarea, 必填) | owner (entitySelect, 从角色列表选择) | tags (text)

**伏笔 Hook**：
- name (text, 必填) | description (textarea, 必填) | status (select: active/resolved, 必填) | plantedAt (number, 必填, 仅创建时) | resolvedAt (number) | relatedEntities (entitySelect, 多选, 从全部实体选择)

**规则 Rule**：
- category (select: style/taboo/narrative_perspective/custom, 必填) | name (text, 必填) | content (textarea, 必填) | priority (select: high/medium/low, 必填)

**自定义 CustomKnowledge**：
- category (text, 必填, 仅创建时可编辑) | name (text, 必填) | content (textarea, 必填) | tags (text)

## 测试计划

- 确保 `pnpm build` 通过（类型检查 + Vite 构建）
- 确保 `pnpm test`（后端 API 测试）通过
- 手动验证：每个 Tab 的创建/编辑/删除/列表刷新

## Steps

1. **扩展 knowledge-store.ts** — 增加 6 种实体的 CRUD actions 和状态
2. **创建 entity-form-dialog.tsx** — 通用表单 Dialog（含 entitySelect）
3. **创建 entity-list.tsx** — 通用实体列表
4. **重构 knowledge.tsx** — 7 Tab 布局 + 世界观/自定义子 Tab
5. **构建验证** — `pnpm build` + `pnpm test`

## Parent Goal

- G02 — Phase 2: 核心流水线 → **补全遗漏的知识库前端管理功能**
