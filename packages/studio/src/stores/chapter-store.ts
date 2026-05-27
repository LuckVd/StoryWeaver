import { create } from 'zustand';
import { api } from '@/lib/api-client';
import type { Book, VolumeMeta, ChapterMeta, Chapter, ChapterStatus, ChapterVersion } from '@storyweaver/core';

interface ChapterState {
  volumes: VolumeMeta[];
  chaptersByVolume: Record<number, ChapterMeta[]>;
  currentChapter: Chapter | null;
  versions: ChapterVersion[];
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
      set({ volumes: book.volumes, chaptersByVolume: byVolume, loading: false });
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  fetchVersions: async (chapterId) => {
    set({ loading: true, error: null });
    try {
      const versions = await api.get<ChapterVersion[]>(`/chapters/${chapterId}/versions`);
      set({ versions, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
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
