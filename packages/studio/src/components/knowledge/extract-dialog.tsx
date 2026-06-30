import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Loader2, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Seal } from '@/components/ui/seal';
import { api } from '@/lib/api-client';
import { useKnowledgeStore } from '@/stores/knowledge-store';
import type { SuggestedEntitiesFull } from '@storyweaver/core';

/**
 * 知识库「AI 智能录入」弹窗。
 *
 * 三态:input(粘贴文字)→ loading(AI 提取)→ confirm(分组确认列表)。
 * 复用 CuratorAgent(/knowledge/extract,无状态)与 store 的 create* 入库;
 * 视觉沿用朱批墨韵(Seal + vermilion),与记忆库 CuratorView 一致。
 */
interface ExtractDialogProps {
  open: boolean;
  onClose: () => void;
}

type Phase = 'input' | 'loading' | 'confirm';
type ItemType = 'characters' | 'worldEntries' | 'hooks' | 'rules';

interface EditableItem {
  key: string;
  type: ItemType;
  checked: boolean;
  name: string;
  /** characters/hooks=description;world/rules=content */
  desc: string;
  /** world 子分类 / rule 分类 */
  category?: string;
  priority?: 'high' | 'medium' | 'low';
  plantedAt?: number;
}

const MAX_CHARS = 20000;

const GROUPS: { type: ItemType; label: string }[] = [
  { type: 'characters', label: '角色' },
  { type: 'worldEntries', label: '世界观' },
  { type: 'hooks', label: '伏笔' },
  { type: 'rules', label: '规则' },
];

const WORLD_CATEGORIES = [
  { value: 'geography', label: '地理' },
  { value: 'power-system', label: '力量体系' },
  { value: 'factions', label: '势力' },
  { value: 'history', label: '历史' },
  { value: 'glossary', label: '术语' },
];
const RULE_CATEGORIES = [
  { value: 'style', label: '风格' },
  { value: 'taboo', label: '禁忌' },
  { value: 'narrative_perspective', label: '叙事视角' },
  { value: 'custom', label: '自定义' },
];
const TYPE_BADGE_LABELS: Record<ItemType, (cat?: string) => string> = {
  characters: () => '角色',
  worldEntries: (cat?: string) => {
    const found = WORLD_CATEGORIES.find((c) => c.value === cat);
    return `世界观·${found?.label ?? cat ?? ''}`;
  },
  hooks: () => '伏笔',
  rules: () => '规则',
};

const PRIORITIES = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

function toItems(result: SuggestedEntitiesFull): EditableItem[] {
  const items: EditableItem[] = [];
  result.characters.forEach((c, i) =>
    items.push({
      key: `c-${i}-${c.name}`,
      type: 'characters',
      checked: true,
      name: c.name,
      desc: c.description,
    }),
  );
  result.worldEntries.forEach((w, i) =>
    items.push({
      key: `w-${i}-${w.name}`,
      type: 'worldEntries',
      checked: true,
      name: w.name,
      desc: w.content,
      category: w.category,
    }),
  );
  result.hooks.forEach((h, i) =>
    items.push({
      key: `h-${i}-${h.name}`,
      type: 'hooks',
      checked: true,
      name: h.name,
      desc: h.description,
      plantedAt: 1,
    }),
  );
  result.rules.forEach((r, i) =>
    items.push({
      key: `r-${i}-${r.name}`,
      type: 'rules',
      checked: true,
      name: r.name,
      desc: r.content,
      category: r.category,
      priority: r.priority,
    }),
  );
  return items;
}

export function ExtractDialog({ open, onClose }: ExtractDialogProps) {
  const [phase, setPhase] = useState<Phase>('input');
  const [text, setText] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; fail: number } | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const store = useKnowledgeStore();

  // 打开时重置到初始态
  useEffect(() => {
    if (open) {
      setPhase('input');
      setText('');
      setItems([]);
      setExtractError(null);
      setImporting(false);
      setImportResult(null);
      setExpandedKey(null);
    }
  }, [open]);

  // 已有同名(用于「已存在」提示;仅比对已加载到 store 的分类)
  const existingNames = useMemo(() => {
    const names = new Set<string>();
    store.characters.forEach((c) => names.add(c.name.trim().toLowerCase()));
    store.worldEntries.forEach((w) => names.add(w.name.trim().toLowerCase()));
    store.hooks.forEach((h) => names.add(h.name.trim().toLowerCase()));
    store.rules.forEach((r) => names.add(r.name.trim().toLowerCase()));
    return names;
  }, [items, store.characters, store.worldEntries, store.hooks, store.rules]);

  if (!open) return null;

  const charCount = text.length;
  const canExtract = text.trim().length > 0 && charCount <= MAX_CHARS;
  const selectedCount = items.filter((i) => i.checked).length;

  const handleExtract = async () => {
    setPhase('loading');
    setExtractError(null);
    try {
      const result = await api.post<SuggestedEntitiesFull>('/knowledge/extract', { text });
      setItems(toItems(result));
      setImportResult(null);
      setPhase('confirm');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : '提取失败');
      setPhase('input');
    }
  };

  const updateItem = (key: string, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const handleImport = async () => {
    const selected = items.filter((i) => i.checked);
    setImporting(true);
    setImportResult(null);
    const tasks = selected.map((item) => {
      if (item.type === 'characters') {
        return store.createCharacter({ name: item.name, description: item.desc });
      }
      if (item.type === 'worldEntries') {
        return store.createWorld({
          category: item.category ?? 'geography',
          name: item.name,
          content: item.desc,
        });
      }
      if (item.type === 'hooks') {
        return store.createHook({
          name: item.name,
          description: item.desc,
          status: 'active',
          plantedAt: item.plantedAt ?? 1,
        });
      }
      return store.createRule({
        category: (item.category ?? 'custom') as 'style' | 'taboo' | 'narrative_perspective' | 'custom',
        name: item.name,
        content: item.desc,
        priority: item.priority ?? 'medium',
      });
    });
    const results = await Promise.allSettled(tasks);
    const failedKeys = new Set<string>();
    selected.forEach((item, idx) => {
      if (results[idx].status === 'rejected') failedKeys.add(item.key);
    });
    const fail = failedKeys.size;
    const ok = results.length - fail;
    setImporting(false);
    if (fail === 0) {
      onClose();
    } else {
      setImportResult({ ok, fail });
      // 仅保留失败项,便于用户修改后重试
      setItems((prev) => prev.filter((it) => failedKeys.has(it.key)));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => !importing && onClose()}
    >
      <div
        className="flex flex-col rounded-lg border bg-background shadow-lg"
        style={{ height: 'calc(100vh - 2rem)', width: 'min(calc(100vw - 2rem), 48rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center gap-2 border-b px-6 py-4 shrink-0">
          <Seal className="h-5 w-5 text-[0.55rem] [transform:none]" variant="filled">朱</Seal>
          <h2 className="font-heading text-lg font-semibold">AI 智能录入</h2>
          <span className="text-xs text-muted-foreground">粘贴设定文字,AI 自动抽取角色 / 世界观 / 伏笔 / 规则</span>
        </div>

        {/* 内容区 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {phase === 'input' && (
            <div className="space-y-3">
              {extractError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {extractError}
                </div>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  '在此粘贴一段设定文字,例如:\n林雾,散修,性格孤僻,身世成谜……\n青冥宗位于苍云山,修五行剑诀……\n全书禁用现代词汇,第一人称叙事……'
                }
                rows={10}
                className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
              />
              <div className="flex justify-end text-xs text-muted-foreground">
                {charCount > MAX_CHARS ? (
                  <span className="text-destructive">
                    {charCount} / {MAX_CHARS} · 超出上限
                  </span>
                ) : (
                  <span>
                    {charCount} / {MAX_CHARS}
                  </span>
                )}
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-vermilion" />
              <span>AI 正在阅读并提取……</span>
            </div>
          )}

          {phase === 'confirm' && (
            <div className="space-y-4">
              {importResult && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  成功 {importResult.ok} 条,失败 {importResult.fail} 条。失败项可修改后重试。
                </div>
              )}
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                  <span>AI 未识别出可入库的实体。</span>
                  <Button variant="outline" size="sm" onClick={() => setPhase('input')}>
                    换一段文字重新输入
                  </Button>
                </div>
              ) : (
                GROUPS.map((g) => {
                  const groupItems = items.filter((i) => i.type === g.type);
                  if (groupItems.length === 0) return null;
                  return (
                    <div
                      key={g.type}
                      className="rounded-lg border border-l-2 border-l-vermilion/40 bg-card p-4 shadow-sm"
                    >
                      <h3 className="mb-2 flex items-center gap-1.5 font-heading text-sm font-medium">
                        <Seal className="h-4 w-4 text-[0.5rem] [transform:none]">朱</Seal>
                        {g.label}
                        <span className="text-xs text-muted-foreground">({groupItems.length})</span>
                      </h3>
                      <div className="divide-y rounded-md bg-background">
                          {groupItems.map((it) => {
                          const exists = existingNames.has(it.name.trim().toLowerCase());
                          const isExpanded = expandedKey === it.key;
                          return (
                            <div key={it.key}>
                              <div
                                className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/40 ${isExpanded ? 'bg-accent/30' : ''}`}
                                onClick={() => setExpandedKey(isExpanded ? null : it.key)}
                              >
                                <input
                                  type="checkbox"
                                  checked={it.checked}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => updateItem(it.key, { checked: e.target.checked })}
                                  className="size-4 accent-vermilion"
                                />
                                <span className="flex-1 truncate font-medium">{it.name}</span>
                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {TYPE_BADGE_LABELS[it.type](it.category)}
                                </span>
                                {exists && (
                                  <span className="shrink-0 rounded bg-amber-100 px-1 text-[10px] text-amber-700">
                                    已存在
                                  </span>
                                )}
                                <ChevronDown
                                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                              </div>
                              {isExpanded && (
                                <div className="space-y-1.5 border-t px-4 pb-3 pt-2">
                                  <input
                                    value={it.name}
                                    onChange={(e) => updateItem(it.key, { name: e.target.value })}
                                    className="w-full rounded border bg-background px-2 py-1 text-sm font-medium"
                                  />
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {it.type === 'worldEntries' && (
                                      <select
                                        value={it.category}
                                        onChange={(e) => updateItem(it.key, { category: e.target.value })}
                                        className="rounded border bg-background px-1.5 py-1 text-xs"
                                      >
                                        {WORLD_CATEGORIES.map((o) => (
                                          <option key={o.value} value={o.value}>
                                            {o.label}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                    {it.type === 'rules' && (
                                      <>
                                        <select
                                          value={it.category}
                                          onChange={(e) => updateItem(it.key, { category: e.target.value })}
                                          className="rounded border bg-background px-1.5 py-1 text-xs"
                                        >
                                          {RULE_CATEGORIES.map((o) => (
                                            <option key={o.value} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </select>
                                        <select
                                          value={it.priority}
                                          onChange={(e) =>
                                            updateItem(it.key, {
                                              priority: e.target.value as 'high' | 'medium' | 'low',
                                            })
                                          }
                                          className="rounded border bg-background px-1.5 py-1 text-xs"
                                        >
                                          {PRIORITIES.map((o) => (
                                            <option key={o.value} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </select>
                                      </>
                                    )}
                                    {it.type === 'hooks' && (
                                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                        埋设章节
                                        <input
                                          type="number"
                                          min={1}
                                          value={it.plantedAt ?? 1}
                                          onChange={(e) =>
                                            updateItem(it.key, {
                                              plantedAt: Math.max(1, Number(e.target.value) || 1),
                                            })
                                          }
                                          className="w-16 rounded border bg-background px-1.5 py-1 text-xs"
                                        />
                                      </label>
                                    )}
                                  </div>
                                  <textarea
                                    value={it.desc}
                                    onChange={(e) => updateItem(it.key, { desc: e.target.value })}
                                    rows={2}
                                    className="w-full resize-y rounded border bg-background px-2 py-1 text-sm text-muted-foreground"
                                  />
                                  <div className="flex justify-end">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setExpandedKey(null)}
                                    >
                                      完成
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-6 py-3">
          <div className="text-xs text-muted-foreground">
            {phase === 'confirm' && items.length > 0 && `已选 ${selectedCount} / ${items.length} 条`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={importing}>
              取消
            </Button>
            {phase === 'input' && (
              <Button variant="vermilion" size="sm" onClick={handleExtract} disabled={!canExtract}>
                <WandSparkles /> 提取
              </Button>
            )}
            {phase === 'confirm' && items.length > 0 && (
              <Button
                variant="vermilion"
                size="sm"
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
              >
                {importing ? <Loader2 className="animate-spin" /> : null}
                {importing ? '入库中…' : `加入选中的 ${selectedCount} 条`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
