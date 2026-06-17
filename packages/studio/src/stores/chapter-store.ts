import { create } from 'zustand';
import { api } from '@/lib/api-client';
import type { Book, VolumeMeta, ChapterMeta, Chapter, ChapterStatus, ChapterVersion } from '@storyweaver/core';

interface ChapterState {
  volumes: VolumeMeta[];
  chaptersByVolume: Record<number, ChapterMeta[]>;
  currentChapter: Chapter | null;
  versions: ChapterVersion[];
  /** 全书章节序号映射：chapterId → 第几章（1-based，按卷顺序+卷内id 跨卷连续） */
  chapterOrder: Record<number, number>;
  loading: boolean;
  error: string | null;

  fetchVolumesAndChapters: () => Promise<void>;
  fetchChapter: (id: number) => Promise<void>;
  saveChapter: (id: number, data: { title?: string; content?: string }) => Promise<void>;
  createVolume: (title: string) => Promise<void>;
  createChapter: (volume: number, title: string) => Promise<void>;
  deleteChapter: (id: number) => Promise<void>;
  updateChapterStatus: (id: number, status: ChapterStatus) => Promise<void>;
  fetchVersions: (chapterId: number) => Promise<void>;
  restoreVersion: (chapterId: number, versionId: number) => Promise<void>;
}

export const useChapterStore = create<ChapterState>((set, get) => ({
  volumes: [],
  chaptersByVolume: {},
  currentChapter: null,
  versions: [],
  chapterOrder: {},
  loading: false,
  error: null,

  fetchVolumesAndChapters: async () => {
    set({ loading: true, error: null });
    try {
      const book = await api.get<Book>('/book');
      const byVolume: Record<number, ChapterMeta[]> = {};
      await Promise.all(
        book.volumes.map(async (v) => {
          const chapters = await api.get<ChapterMeta[]>(`/chapters?volume=${v.id}`);
          byVolume[v.id] = chapters;
        }),
      );
      // 全书序号：按卷顺序 + 卷内 id 排序，跨卷连续（1,2,3...）
      const orderedIds: number[] = [];
      for (const v of [...book.volumes].sort((a, b) => a.id - b.id)) {
        const chs = (byVolume[v.id] ?? []).slice().sort((a, b) => a.id - b.id);
        orderedIds.push(...chs.map((c) => c.id));
      }
      const chapterOrder: Record<number, number> = {};
      orderedIds.forEach((id, i) => {
        chapterOrder[id] = i + 1;
      });
      set({ volumes: book.volumes, chaptersByVolume: byVolume, chapterOrder, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  fetchChapter: async (id) => {
    set({ loading: true, error: null });
    try {
      const chapter = await api.get<Chapter>(`/chapters/${id}`);
      set({ currentChapter: chapter, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  saveChapter: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const chapter = await api.put<Chapter>(`/chapters/${id}`, data);
      set({ currentChapter: chapter, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  createVolume: async (title) => {
    set({ loading: true, error: null });
    try {
      await api.post('/volumes', { title });
      await get().fetchVolumesAndChapters();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  createChapter: async (volume, title) => {
    set({ loading: true, error: null });
    try {
      await api.post('/chapters', { volume, title });
      await get().fetchVolumesAndChapters();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  deleteChapter: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.del(`/chapters/${id}`);
      await get().fetchVolumesAndChapters();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  updateChapterStatus: async (id, status) => {
    set({ loading: true, error: null });
    try {
      await api.put(`/chapters/${id}/status`, { status });
      await get().fetchVolumesAndChapters();
      // 如果正在查看此章节，刷新 currentChapter
      if (get().currentChapter?.id === id) {
        await get().fetchChapter(id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  fetchVersions: async (chapterId) => {
    // 不修改全局 loading：VersionPanel 用独立的 loadingVersions。
    // 若设全局 loading 会触发 chapter-edit 全屏加载态 → 卸载 VersionPanel →
    // 重新 mount → 再次 fetchVersions，形成永远"加载中"的死循环。
    try {
      const versions = await api.get<ChapterVersion[]>(`/chapters/${chapterId}/versions`);
      set({ versions });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  restoreVersion: async (chapterId, versionId) => {
    set({ loading: true, error: null });
    try {
      const chapter = await api.post<Chapter>(`/chapters/${chapterId}/versions/${versionId}/restore`, {});
      set({ currentChapter: chapter, loading: false });
      await get().fetchVersions(chapterId);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },
}));
