import { create } from 'zustand';
import { api } from '@/lib/api-client';
import type { ChatSession, ChatMessage } from '@storyweaver/core';
import { useChapterStore } from './chapter-store';

interface ChatState {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  // Streaming state
  streamingText: string;
  streamingAgent: string | null;
  isStreaming: boolean;
  streamingSessionId: string | null;
  // General
  loading: boolean;
  error: string | null;

  // Session actions
  fetchSessions: () => Promise<void>;
  createSession: (opts?: { chapterId?: number; title?: string }) => Promise<ChatSession>;
  fetchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  setCurrentSession: (session: ChatSession | null) => void;

  // Message actions
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  applyMessage: (
    sessionId: string,
    messageId: string,
    chapterId: number,
    mode: 'append' | 'replace',
  ) => Promise<void>;

  // Stream actions (called by useChatSSE)
  startStream: (agent: string) => void;
  appendStreamToken: (token: string) => void;
  completeStream: (messageId: string) => void;
  setStreamError: (message: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSession: null,
  streamingText: '',
  streamingAgent: null,
  isStreaming: false,
  streamingSessionId: null,
  loading: false,
  error: null,

  // --- Sessions ---

  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const sessions = await api.get<ChatSession[]>('/chat/sessions');
      set({ sessions, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  createSession: async (opts) => {
    set({ loading: true, error: null });
    try {
      const session = await api.post<ChatSession>('/chat/sessions', opts ?? {});
      set((s) => ({ sessions: [session, ...s.sessions], currentSession: session, loading: false }));
      return session;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
      throw err;
    }
  },

  fetchSession: async (id) => {
    set({ loading: true, error: null });
    try {
      const session = await api.get<ChatSession>(`/chat/sessions/${id}`);
      set({ currentSession: session, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  deleteSession: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.del(`/chat/sessions/${id}`);
      const { currentSession } = get();
      set((s) => ({
        sessions: s.sessions.filter((ss) => ss.id !== id),
        currentSession: currentSession?.id === id ? null : currentSession,
        loading: false,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  setCurrentSession: (session) => {
    set({ currentSession: session });
  },

  // --- Messages ---

  sendMessage: async (sessionId, message) => {
    set({ error: null });
    try {
      const { currentSession } = get();
      // Optimistically append user message
      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      };
      if (currentSession?.id === sessionId) {
        set({ currentSession: { ...currentSession, messages: [...currentSession.messages, userMsg] } });
      }
      // Set streaming target
      set({ streamingSessionId: sessionId, streamingText: '', isStreaming: false });
      await api.post(`/chat/sessions/${sessionId}/messages`, {
        message,
        context: { chapterRef: currentSession?.chapterId ?? undefined },
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', streamingSessionId: null });
    }
  },

  applyMessage: async (sessionId, messageId, chapterId, mode) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post<{ content: string }>(`/chat/sessions/${sessionId}/apply`, { messageId, chapterId, mode });
      // 用标记位通知 chapter-edit 跳过 useEffect 重置
      (window as unknown as Record<string, unknown>).__skipEditorReset = true;
      const chapter = useChapterStore.getState().currentChapter;
      if (chapter && chapter.id === chapterId) {
        useChapterStore.setState({
          currentChapter: { ...chapter, content: res.content, updatedAt: new Date().toISOString() },
        });
      }
      set({ loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  // --- Streaming ---

  startStream: (agent) => {
    set({ isStreaming: true, streamingAgent: agent, streamingText: '' });
  },

  appendStreamToken: (token) => {
    set((s) => ({ streamingText: s.streamingText + token }));
  },

  completeStream: (messageId: string) => {
    const { streamingSessionId, streamingText, currentSession } = get();
    // Append assistant message to current session
    if (streamingSessionId && currentSession?.id === streamingSessionId) {
      const assistantMsg: ChatMessage = {
        id: messageId,
        role: 'assistant',
        content: streamingText,
        createdAt: new Date().toISOString(),
        agent: get().streamingAgent ?? undefined,
      };
      set({
        currentSession: {
          ...currentSession,
          messages: [...currentSession.messages, assistantMsg],
          updatedAt: new Date().toISOString(),
        },
      });
    }
    set({
      isStreaming: false,
      streamingText: '',
      streamingAgent: null,
      streamingSessionId: null,
    });
  },

  setStreamError: (message) => {
    set({ isStreaming: false, streamingText: '', error: message, streamingSessionId: null });
  },
}));
