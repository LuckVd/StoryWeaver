import { create } from 'zustand';
import { api } from '@/lib/api-client';
import type { ChapterMeta } from '@storyweaver/core';

/** 工作区内章节（含卷号） */
export interface WorkspaceChapter extends ChapterMeta {
  volume: number;
}

/** 发布进度（来自 SSE publish:progress） */
export interface PublishProgress {
  step: string; // 'publishing' | 'summarizing'
  current: number;
  total: number;
}

interface PublishResult {
  published: number[];
  summarized: number[];
  skipped: number[];
}

interface WorkspaceState {
  chapters: WorkspaceChapter[];
  loading: boolean;
  error: string | null;
  publishing: boolean;
  publishProgress: PublishProgress | null;
  publishResult: PublishResult | null;

  fetchWorkspace: () => Promise<void>;
  addChapter: (chapterId: number) => Promise<void>;
  removeChapter: (chapterId: number) => Promise<void>;
  publish: (chapterIds: number[], skipSummary?: boolean) => Promise<void>;
  setPublishProgress: (p: PublishProgress | null) => void;
  clearPublish: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  chapters: [],
  loading: false,
  error: null,
  publishing: false,
  publishProgress: null,
  publishResult: null,

  fetchWorkspace: async () => {
    set({ loading: true, error: null });
    try {
      const ws = await api.get<{ chapterIds: number[]; chapters: WorkspaceChapter[] }>('/workspace');
      set({ chapters: ws.chapters ?? [], loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  addChapter: async (chapterId) => {
    try {
      await api.post('/workspace/chapters', { chapterId });
      await get().fetchWorkspace();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  removeChapter: async (chapterId) => {
    try {
      await api.del(`/workspace/chapters/${chapterId}`);
      await get().fetchWorkspace();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  publish: async (chapterIds, skipSummary) => {
    set({
      publishing: true,
      error: null,
      publishProgress: { step: 'publishing', current: 0, total: chapterIds.length },
      publishResult: null,
    });
    try {
      const result = await api.post<PublishResult>('/workspace/publish', { chapterIds, skipSummary });
      set({ publishing: false, publishResult: result, publishProgress: null });
      await get().fetchWorkspace();
    } catch (err) {
      set({
        publishing: false,
        error: err instanceof Error ? err.message : '发布失败',
        publishProgress: null,
      });
    }
  },

  setPublishProgress: (p) => {
    if (get().publishing) set({ publishProgress: p });
  },

  clearPublish: () => set({ publishResult: null, publishProgress: null, error: null }),
}));
