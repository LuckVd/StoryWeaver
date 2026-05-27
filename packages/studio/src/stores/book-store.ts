import { create } from 'zustand';
import { api } from '@/lib/api-client';
import type { Book } from '@storyweaver/core';

interface BookState {
  book: Book | null;
  loading: boolean;
  error: string | null;
  fetchBook: () => Promise<void>;
  createBook: (input: { title: string; genre: string; language: string }) => Promise<void>;
  updateBook: (patch: Partial<Pick<Book, 'title' | 'genre' | 'language' | 'status'>>) => Promise<void>;
}

export const useBookStore = create<BookState>((set) => ({
  book: null,
  loading: false,
  error: null,

  fetchBook: async () => {
    set({ loading: true, error: null });
    try {
      const book = await api.get<Book>('/book');
      set({ book, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('404') || message.includes('不存在')) {
        set({ book: null, loading: false });
      } else {
        set({ error: message, loading: false });
      }
    }
  },

  createBook: async (input) => {
    set({ loading: true, error: null });
    try {
      const book = await api.post<Book>('/book', input);
      set({ book, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  updateBook: async (patch) => {
    set({ loading: true, error: null });
    try {
      const book = await api.put<Book>('/book', patch);
      set({ book, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },
}));
