import { useState, useCallback, useMemo } from 'react';
import { useKnowledgeStore } from '@/stores/knowledge-store';
import { RelationGraph } from '@/components/knowledge/relation-graph';
import { EntityList, type ColumnDef } from '@/components/knowledge/entity-list';
import { EntityFormDialog, type FieldDef } from '@/components/knowledge/entity-form-dialog';
import { cn } from '@/lib/utils';
import type {
  Character,
  WorldEntry,
  Item,
  Hook,
  Rule,
  CustomKnowledge,
} from '@storyweaver/core';

// ── Tab 定义 ──

const tabs = [
  { key: 'characters', label: '角色' },
  { key: 'world', label: '世界观' },
  { key: 'items', label: '物品' },
  { key: 'hooks', label: '伏笔' },
  { key: 'rules', label: '规则' },
  { key: 'custom', label: '自定义' },
  { key: 'graph', label: '关系图' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

// ── 世界观子分类 ──

const worldSubCategories = [
  { key: '', label: '全部' },
  { key: 'geography', label: '地理' },
  { key: 'power-system', label: '力量体系' },
  { key: 'factions', label: '势力' },
  { key: 'history', label: '历史' },
  { key: 'glossary', label: '术语' },
] as const;

const worldCategoryLabels: Record<string, string> = {
  geography: '地理',
  'power-system': '力量体系',
  factions: '势力',
  history: '历史',
  glossary: '术语',
};

// ── 规则子分类 ──

const ruleCategoryLabels: Record<string, string> = {
  style: '风格',
  taboo: '禁忌',
  narrative_perspective: '叙事视角',
  custom: '自定义',
};

// ── 字段配置 ──

function getCharacterFields(): FieldDef[] {
  return [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'aliases', label: '别名', type: 'text', placeholder: '别名1,别名2' },
    { name: 'description', label: '简介', type: 'textarea', required: true },
    { name: 'profile', label: '详细档案', type: 'textarea' },
    { name: 'firstAppearance', label: '首次出场章节', type: 'number', placeholder: '章节 ID' },
    { name: 'tags', label: '标签', type: 'text', placeholder: '标签1,标签2' },
  ];
}

function getWorldFields(editing: boolean): FieldDef[] {
  return [
    {
      name: 'category',
      label: '分类',
      type: 'select',
      required: true,
      disabledOnEdit: true,
      options: [
        { value: 'geography', label: '地理' },
        { value: 'power-system', label: '力量体系' },
        { value: 'factions', label: '势力' },
        { value: 'history', label: '历史' },
        { value: 'glossary', label: '术语' },
      ],
    },
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'content', label: '内容', type: 'textarea', required: true },
    { name: 'tags', label: '标签', type: 'text', placeholder: '标签1,标签2' },
  ];
}

function getItemFields(characters: Character[]): FieldDef[] {
  return [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'description', label: '描述', type: 'textarea', required: true },
    {
      name: 'owner',
      label: '持有者',
      type: 'entitySelect',
      entityOptions: characters.map((c) => ({ id: c.id, name: c.name })),
      placeholder: '搜索角色...',
    },
    { name: 'tags', label: '标签', type: 'text', placeholder: '标签1,标签2' },
  ];
}

function getHookFields(entities: { id: string; name: string }[]): FieldDef[] {
  return [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'description', label: '描述', type: 'textarea', required: true },
    {
      name: 'status',
      label: '状态',
      type: 'select',
      required: true,
      options: [
        { value: 'active', label: '进行中' },
        { value: 'resolved', label: '已回收' },
      ],
    },
    { name: 'plantedAt', label: '埋设章节', type: 'number', required: true, placeholder: '章节 ID' },
    { name: 'resolvedAt', label: '回收章节', type: 'number', placeholder: '章节 ID' },
    {
      name: 'relatedEntities',
      label: '关联实体',
      type: 'entitySelect',
      multiple: true,
      entityOptions: entities,
      placeholder: '搜索实体...',
    },
  ];
}

function getRuleFields(): FieldDef[] {
  return [
    {
      name: 'category',
      label: '分类',
      type: 'select',
      required: true,
      options: [
        { value: 'style', label: '风格' },
        { value: 'taboo', label: '禁忌' },
        { value: 'narrative_perspective', label: '叙事视角' },
        { value: 'custom', label: '自定义' },
      ],
    },
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'content', label: '内容', type: 'textarea', required: true },
    {
      name: 'priority',
      label: '优先级',
      type: 'select',
      required: true,
      options: [
        { value: 'high', label: '高' },
        { value: 'medium', label: '中' },
        { value: 'low', label: '低' },
      ],
    },
  ];
}

function getCustomFields(editing: boolean): FieldDef[] {
  return [
    { name: 'category', label: '分类名', type: 'text', required: true, disabledOnEdit: true },
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'content', label: '内容', type: 'textarea', required: true },
    { name: 'tags', label: '标签', type: 'text', placeholder: '标签1,标签2' },
  ];
}

// ── 列配置 ──

const characterColumns: ColumnDef<Character>[] = [
  { key: 'name', label: '名称' },
  { key: 'aliases', label: '别名', render: (c) => c.aliases?.join(', ') ?? '-' },
  { key: 'description', label: '简介' },
];

const worldColumns: ColumnDef<WorldEntry>[] = [
  { key: 'category', label: '分类', render: (w) => worldCategoryLabels[w.category] ?? w.category },
  { key: 'name', label: '名称' },
  { key: 'content', label: '内容' },
];

function getItemColumns(characters: Character[]): ColumnDef<Item>[] {
  return [
    { key: 'name', label: '名称' },
    { key: 'description', label: '描述' },
    {
      key: 'owner',
      label: '持有者',
      render: (i) => {
        const owner = characters.find((c) => c.id === i.owner);
        return owner ? owner.name : (i.owner || '-');
      },
    },
  ];
}

const hookColumns: ColumnDef<Hook>[] = [
  { key: 'name', label: '名称' },
  { key: 'status', label: '状态', render: (h) => (h.status === 'active' ? '进行中' : '已回收') },
  { key: 'plantedAt', label: '埋设章节', render: (h) => String(h.plantedAt) },
];

const ruleColumns: ColumnDef<Rule>[] = [
  { key: 'category', label: '分类', render: (r) => ruleCategoryLabels[r.category] ?? r.category },
  { key: 'name', label: '名称' },
  { key: 'priority', label: '优先级', render: (r) => ({ high: '高', medium: '中', low: '低' }[r.priority] ?? r.priority) },
];

const customColumns: ColumnDef<CustomKnowledge>[] = [
  { key: 'name', label: '名称' },
  { key: 'content', label: '内容' },
];

// ── 主页面 ──

export function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('characters');
  const [worldSub, setWorldSub] = useState('');
  const [customSub, setCustomSub] = useState('');
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Dialog 状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});

  const store = useKnowledgeStore();

  // 当前 entitySelect 需要的实体列表
  const allEntities = useMemo(
    () => [
      ...store.characters.map((c) => ({ id: c.id, name: c.name })),
      ...store.worldEntries.map((w) => ({ id: w.id, name: w.name })),
      ...store.items.map((i) => ({ id: i.id, name: i.name })),
      ...store.hooks.map((h) => ({ id: h.id, name: h.name })),
      ...store.rules.map((r) => ({ id: r.id, name: r.name })),
    ],
    [store.characters, store.worldEntries, store.items, store.hooks, store.rules],
  );

  // 当前 Tab 对应的字段配置
  const currentFields = useMemo((): FieldDef[] => {
    switch (activeTab) {
      case 'characters': return getCharacterFields();
      case 'world': return getWorldFields(editing);
      case 'items': return getItemFields(store.characters);
      case 'hooks': return getHookFields(allEntities);
      case 'rules': return getRuleFields();
      case 'custom': return getCustomFields(editing);
      default: return [];
    }
  }, [activeTab, editing, store.characters, allEntities]);

  // Tab 切换时按需加载数据
  const handleTabChange = useCallback(
    (key: TabKey) => {
      setActiveTab(key);
      switch (key) {
        case 'characters': store.fetchCharacters(); break;
        case 'world': store.fetchWorld(); break;
        case 'items': store.fetchItems(); break;
        case 'hooks': store.fetchHooks(); break;
        case 'rules': store.fetchRules(); break;
        case 'custom': store.fetchCustomCategories(); break;
        case 'graph': store.fetchAll(); break;
      }
    },
    [store],
  );

  // 初始加载
  const _initialized = useMemo(() => {
    store.fetchCharacters();
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 世界观过滤
  const filteredWorld = useMemo(() => {
    if (!worldSub) return store.worldEntries;
    return store.worldEntries.filter((w) => w.category === worldSub);
  }, [store.worldEntries, worldSub]);

  // 当前自定义分类下的条目
  const currentCustomEntries = customSub ? (store.customEntries[customSub] ?? []) : [];

  // ── Dialog 操作 ──

  const openCreate = () => {
    setEditing(false);
    setEditValues({});
    if (activeTab === 'custom' && customSub) {
      setEditValues({ category: customSub });
    }
    setDialogOpen(true);
  };

  const openEdit = (item: Record<string, unknown>) => {
    setEditing(true);
    // 把 tags/aliases 数组转成逗号分隔字符串方便编辑
    const vals = { ...item };
    if (Array.isArray(vals.tags)) vals.tags = vals.tags.join(', ');
    if (Array.isArray(vals.aliases)) vals.aliases = vals.aliases.join(', ');
    if (Array.isArray(vals.relatedEntities)) vals.relatedEntities = vals.relatedEntities.join(', ');
    setEditValues(vals);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      switch (activeTab) {
        case 'characters':
          if (editing) {
            await store.updateCharacter(values.id as string, values);
          } else {
            await store.createCharacter(values as never);
          }
          break;
        case 'world':
          if (editing) {
            await store.updateWorld(
              (values as Record<string, unknown>)._category as string,
              values.id as string,
              values,
            );
          } else {
            await store.createWorld(values as never);
          }
          break;
        case 'items':
          if (editing) {
            await store.updateItem(values.id as string, values);
          } else {
            await store.createItem(values as never);
          }
          break;
        case 'hooks':
          if (editing) {
            await store.updateHook(values.id as string, values);
          } else {
            await store.createHook(values as never);
          }
          break;
        case 'rules':
          if (editing) {
            await store.updateRule(values.id as string, values);
          } else {
            await store.createRule(values as never);
          }
          break;
        case 'custom':
          if (editing) {
            await store.updateCustom(
              (values as Record<string, unknown>)._category as string,
              values.id as string,
              values,
            );
          } else {
            await store.createCustom(values as never);
          }
          break;
      }
      setDialogOpen(false);
    } catch {
      // store 会设置 error
    }
  };

  const handleDelete = async (id: string) => {
    switch (activeTab) {
      case 'characters': await store.deleteCharacter(id); break;
      case 'world': {
        const entry = store.worldEntries.find((w) => w.id === id);
        if (entry) await store.deleteWorld(entry.category, id);
        break;
      }
      case 'items': await store.deleteItem(id); break;
      case 'hooks': await store.deleteHook(id); break;
      case 'rules': await store.deleteRule(id); break;
      case 'custom': {
        if (customSub) await store.deleteCustom(customSub, id);
        break;
      }
    }
  };

  // 为编辑时保存额外元数据（category 等）
  const handleEdit = (item: Character | WorldEntry | Item | Hook | Rule | CustomKnowledge) => {
    const ext: Record<string, unknown> = { ...item };
    if (activeTab === 'world') ext._category = (item as WorldEntry).category;
    if (activeTab === 'custom') ext._category = (item as CustomKnowledge).category;
    openEdit(ext);
  };

  return (
    <div className="flex h-full flex-col">
      {/* 主 Tab 栏 */}
      <div className="flex items-center border-b px-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-auto p-6">
        {/* 角色列表 */}
        {activeTab === 'characters' && (
          <EntityList
            columns={characterColumns}
            data={store.characters}
            onCreate={openCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={!store.loaded.characters}
            emptyText="暂无角色，点击新建添加"
            createLabel="新建角色"
          />
        )}

        {/* 世界观 */}
        {activeTab === 'world' && (
          <div>
            <div className="mb-4 flex gap-1">
              {worldSubCategories.map((sub) => (
                <button
                  key={sub.key}
                  onClick={() => setWorldSub(sub.key)}
                  className={cn(
                    'rounded-md px-3 py-1 text-sm transition-colors',
                    worldSub === sub.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {sub.label}
                </button>
              ))}
            </div>
            <EntityList
              columns={worldColumns}
              data={filteredWorld}
              onCreate={openCreate}
              onEdit={handleEdit}
              onDelete={handleDelete}
              loading={!store.loaded.world}
              emptyText="暂无世界观条目，点击新建添加"
              createLabel="新建世界观条目"
            />
          </div>
        )}

        {/* 物品 */}
        {activeTab === 'items' && (
          <EntityList
            columns={getItemColumns(store.characters)}
            data={store.items}
            onCreate={openCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={!store.loaded.items}
            emptyText="暂无物品，点击新建添加"
            createLabel="新建物品"
          />
        )}

        {/* 伏笔 */}
        {activeTab === 'hooks' && (
          <EntityList
            columns={hookColumns}
            data={store.hooks}
            onCreate={openCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={!store.loaded.hooks}
            emptyText="暂无伏笔，点击新建添加"
            createLabel="新建伏笔"
          />
        )}

        {/* 规则 */}
        {activeTab === 'rules' && (
          <EntityList
            columns={ruleColumns}
            data={store.rules}
            onCreate={openCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={!store.loaded.rules}
            emptyText="暂无规则，点击新建添加"
            createLabel="新建规则"
          />
        )}

        {/* 自定义 */}
        {activeTab === 'custom' && (
          <div>
            <div className="mb-4 flex gap-1">
              {store.customCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCustomSub(cat);
                    store.fetchCustom(cat);
                  }}
                  className={cn(
                    'rounded-md px-3 py-1 text-sm transition-colors',
                    customSub === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {cat}
                </button>
              ))}
              <button
                onClick={() => {
                  setNewCatName('');
                  setNewCatOpen(true);
                }}
                className="rounded-md border px-3 py-1 text-sm text-muted-foreground hover:bg-accent"
              >
                + 新分类
              </button>
            </div>

            {newCatOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                onClick={() => setNewCatOpen(false)}
              >
                <div
                  className="w-96 rounded-lg border bg-background p-6 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="mb-3 text-lg font-semibold">新建自定义分类</h2>
                  <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="分类名（如：势力、功法）"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    autoFocus
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => setNewCatOpen(false)} className="rounded border px-3 py-1">
                      取消
                    </button>
                    <button
                      onClick={async () => {
                        const name = newCatName.trim();
                        if (!name) return;
                        await store.createCustomCategory(name);
                        setCustomSub(name);
                        store.fetchCustom(name);
                        setNewCatOpen(false);
                      }}
                      className="rounded bg-primary px-3 py-1 text-primary-foreground"
                    >
                      创建
                    </button>
                  </div>
                </div>
              </div>
            )}
            {customSub ? (
              <EntityList
                columns={customColumns}
                data={currentCustomEntries}
                onCreate={openCreate}
                onEdit={handleEdit}
                onDelete={handleDelete}
                emptyText="暂无条目，点击新建添加"
                createLabel="新建条目"
              />
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                选择或创建一个分类
              </div>
            )}
          </div>
        )}

        {/* 关系图 */}
        {activeTab === 'graph' && (
          <div className="-m-6 h-[calc(100%+3rem)]">
            <RelationGraph />
          </div>
        )}
      </div>

      {/* 表单 Dialog */}
      <EntityFormDialog
        open={dialogOpen}
        editing={editing}
        title={
          editing
            ? `编辑${tabs.find((t) => t.key === activeTab)?.label ?? ''}`
            : `新建${tabs.find((t) => t.key === activeTab)?.label ?? ''}`
        }
        fields={currentFields}
        values={editValues}
        onSubmit={handleSubmit}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
