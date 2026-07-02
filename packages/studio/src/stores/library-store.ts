import { create } from 'zustand';
import { api } from '@/lib/api-client';
import type { BookshelfItem, Book } from '@storyweaver/core';

interface ActivityDay {
  date: string;
  words: number;
}

interface LibraryState {
  books: BookshelfItem[];
  current: string | null;
  activity: ActivityDay[];
  loading: boolean;
  error: string | null;
  fetchLibrary: () => Promise<void>;
  fetchActivity: (days?: number) => Promise<void>;
  createBook: (input: { title: string; author?: string; genre: string; language: string }) => Promise<void>;
  /** 编辑指定书(书架卡片)→ 刷新列表 */
  updateBook: (
    slug: string,
    patch: Partial<Pick<Book, 'title' | 'author' | 'genre' | 'language' | 'status'>>,
  ) => Promise<void>;
  /** 删除指定书 → 刷新列表 */
  deleteBook: (slug: string) => Promise<void>;
  activate: (slug: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  current: null,
  activity: [],
  loading: false,
  error: null,

  fetchLibrary: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ books: BookshelfItem[]; current: string | null }>('/library');
      set({ books: data.books, current: data.current, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  // 写作活跃聚合(跨所有书),失败静默(非关键)
  fetchActivity: async (days = 364) => {
    try {
      const data = await api.get<{ activity: ActivityDay[] }>(`/library/activity?days=${days}`);
      set({ activity: data.activity });
    } catch {
      /* 非关键,忽略 */
    }
  },

  // 新建后后端已切换到新书 → 整页 reload 拉取新书数据(切书 = 重建容器,需重载)
  createBook: async (input) => {
    set({ loading: true, error: null });
    try {
      await api.post<{ slug: string; book: Book }>('/library', input);
      // 切书 = 重建后端容器,整页 reload 拉取新书;file:// 下不能用 href='/'(会跳文件系统根 → 白屏)
      window.location.reload();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  updateBook: async (slug, patch) => {
    set({ loading: true, error: null });
    try {
      await api.put<Book>(`/library/${slug}`, patch);
      await get().fetchLibrary();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  deleteBook: async (slug) => {
    set({ loading: true, error: null });
    try {
      await api.del<{ success: boolean }>(`/library/${slug}`);
      await get().fetchLibrary();
      await get().fetchActivity();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  // 切换成功 → 整页 reload
  activate: async (slug) => {
    set({ loading: true, error: null });
    try {
      await api.post<{ slug: string; book: Book }>(`/library/${slug}/activate`, {});
      // 切书后整页刷新,所有 store 重新拉取新书(file:// 下不能用 href='/',会跳文件系统根)
      window.location.reload();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },
}));
