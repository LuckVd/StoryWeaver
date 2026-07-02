import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'entitySelect';
  required?: boolean;
  placeholder?: string;
  /** select options */
  options?: { value: string; label: string }[];
  /** entitySelect: 供选择的实体列表 */
  entityOptions?: { id: string; name: string }[];
  /** entitySelect: 是否多选 */
  multiple?: boolean;
  /** 编辑时禁用（如 category 字段） */
  disabledOnEdit?: boolean;
};

interface EntityFormDialogProps {
  open: boolean;
  editing: boolean;
  title: string;
  fields: FieldDef[];
  values: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
  onClose: () => void;
  loading?: boolean;
}

export function EntityFormDialog({
  open,
  editing,
  title,
  fields,
  values,
  onSubmit,
  onClose,
  loading,
}: EntityFormDialogProps) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [entitySearch, setEntitySearch] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm({ ...values });
      setEntitySearch({});
    }
  }, [open, values]);

  const handleChange = (name: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 保留非表单字段（id、_category 等元数据），编辑提交依赖 values.id
    const cleaned: Record<string, unknown> = { ...form };
    for (const f of fields) {
      let val = form[f.name];
      // tags/aliases: comma-separated string → string[]
      if ((f.name === 'tags' || f.name === 'aliases') && typeof val === 'string') {
        val = val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      // relatedEntities: string → string[]
      if (f.name === 'relatedEntities' && typeof val === 'string') {
        val = val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      // number fields
      if (f.type === 'number' && typeof val === 'string') {
        val = val ? Number(val) : undefined;
      }
      cleaned[f.name] = val;
    }
    onSubmit(cleaned);
  };

  if (!open) return null;

  // Filtered entity options for entitySelect
  const getFilteredEntities = (field: FieldDef) => {
    const search = (entitySearch[field.name] ?? '').toLowerCase();
    if (!field.entityOptions) return [];
    if (!search) return field.entityOptions;
    return field.entityOptions.filter((e) => e.name.toLowerCase().includes(search));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 shrink-0 text-lg font-semibold">{title}</h2>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {fields.map((f) => {
            const isDisabled = f.disabledOnEdit && editing;
            return (
              <div key={f.name} className="space-y-1">
                <Label htmlFor={f.name}>
                  {f.label}
                  {f.required && <span className="ml-0.5 text-destructive">*</span>}
                </Label>

                {/* select */}
                {f.type === 'select' && (
                  <select
                    id={f.name}
                    value={String(form[f.name] ?? '')}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                    disabled={isDisabled}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="">请选择</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}

                {/* entitySelect with fuzzy search */}
                {f.type === 'entitySelect' && (
                  <div className="space-y-1">
                    {!f.multiple ? (
                      <>
                        <Input
                          placeholder={f.placeholder ?? '输入关键词搜索...'}
                          value={entitySearch[f.name] ?? ''}
                          onChange={(e) =>
                            setEntitySearch((prev) => ({ ...prev, [f.name]: e.target.value }))
                          }
                        />
                        {form[f.name] && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            已选：
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                              {f.entityOptions?.find((e) => e.id === form[f.name])?.name ?? String(form[f.name])}
                            </span>
                            <button
                              type="button"
                              className="text-destructive/70 hover:text-destructive"
                              onClick={() => handleChange(f.name, undefined)}
                            >
                              清除
                            </button>
                          </div>
                        )}
                        {entitySearch[f.name] && (
                          <div className="max-h-32 overflow-auto rounded border">
                            {getFilteredEntities(f).length === 0 && (
                              <div className="px-3 py-2 text-xs text-muted-foreground">无匹配结果</div>
                            )}
                            {getFilteredEntities(f).map((e) => (
                              <button
                                key={e.id}
                                type="button"
                                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-accent ${
                                  form[f.name] === e.id ? 'bg-accent font-medium' : ''
                                }`}
                                onClick={() => {
                                  handleChange(f.name, e.id);
                                  setEntitySearch((prev) => ({ ...prev, [f.name]: '' }));
                                }}
                              >
                                {e.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <Input
                          placeholder={f.placeholder ?? '输入关键词搜索，回车添加...'}
                          value={entitySearch[f.name] ?? ''}
                          onChange={(e) =>
                            setEntitySearch((prev) => ({ ...prev, [f.name]: e.target.value }))
                          }
                        />
                        <div className="flex flex-wrap gap-1">
                          {((form[f.name] as string[]) ?? []).map((id) => (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                            >
                              {f.entityOptions?.find((e) => e.id === id)?.name ?? id}
                              <button
                                type="button"
                                className="text-primary/60 hover:text-primary"
                                onClick={() =>
                                  handleChange(
                                    f.name,
                                    ((form[f.name] as string[]) ?? []).filter((x) => x !== id),
                                  )
                                }
                              >
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                        {entitySearch[f.name] && (
                          <div className="max-h-32 overflow-auto rounded border">
                            {getFilteredEntities(f)
                              .filter((e) => !((form[f.name] as string[]) ?? []).includes(e.id))
                              .map((e) => (
                                <button
                                  key={e.id}
                                  type="button"
                                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                                  onClick={() => {
                                    const current = (form[f.name] as string[]) ?? [];
                                    handleChange(f.name, [...current, e.id]);
                                    setEntitySearch((prev) => ({ ...prev, [f.name]: '' }));
                                  }}
                                >
                                  {e.name}
                                </button>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* textarea */}
                {f.type === 'textarea' && (
                  <textarea
                    id={f.name}
                    value={String(form[f.name] ?? '')}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    disabled={isDisabled}
                    rows={3}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
                  />
                )}

                {/* number */}
                {f.type === 'number' && (
                  <Input
                    id={f.name}
                    type="number"
                    value={form[f.name] != null ? String(form[f.name]) : ''}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    disabled={isDisabled}
                  />
                )}

                {/* text (default) */}
                {f.type === 'text' && (
                  <Input
                    id={f.name}
                    value={String(form[f.name] ?? '')}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    disabled={isDisabled}
                  />
                )}
              </div>
            );
          })}

          </div>
          <div className="flex shrink-0 justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '提交中...' : '确认'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
