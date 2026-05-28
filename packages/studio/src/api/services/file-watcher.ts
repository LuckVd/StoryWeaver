/**
 * 文件监听服务
 *
 * 使用 chokidar 监听 volumes/ 和 knowledge/ 目录，
 * 文件变化时增量更新 SearchEngine 索引并广播 SSE 事件。
 */

import { watch, type FSWatcher } from 'chokidar';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { InMemorySearchEngine } from '@storyweaver/core';
import type { SSEEmitter } from '../sse.js';

export class FileWatcher {
  private watcher: FSWatcher | null = null;

  constructor(
    private searchEngine: InMemorySearchEngine,
    private sseEmitter: SSEEmitter,
    private projectRoot: string,
  ) {}

  /** 启动文件监听 */
  start(): void {
    const volumesDir = path.join(this.projectRoot, 'volumes');
    const knowledgeDir = path.join(this.projectRoot, 'knowledge');

    this.watcher = watch([volumesDir, knowledgeDir], {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath: string) => this.handleEvent('add', filePath));
    this.watcher.on('change', (filePath: string) => this.handleEvent('change', filePath));
    this.watcher.on('unlink', (filePath: string) => this.handleEvent('unlink', filePath));
  }

  /** 停止文件监听 */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /** 处理文件事件 */
  private async handleEvent(
    event: 'add' | 'change' | 'unlink',
    filePath: string,
  ): Promise<void> {
    const relPath = path.relative(this.projectRoot, filePath);
    const parsed = this.searchEngine.parsePath(relPath);
    if (!parsed) return;

    if (event === 'unlink') {
      this.searchEngine.removeByPath(relPath);
      this.sseEmitter.emit({ type: 'file:removed', data: { path: relPath } });
      return;
    }

    // add / change → 读取文件内容并更新索引
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (parsed.type === 'chapter') {
        const title = this.extractChapterTitle(content);
        this.searchEngine.updateChapter(parseInt(parsed.id, 10), title, content);
      } else if (parsed.type === 'knowledge') {
        const { title, content: summary } = this.extractKnowledge(content);
        this.searchEngine.updateKnowledge(parsed.id, title, summary);
      }

      const sseType = event === 'add' ? 'file:added' : 'file:changed';
      this.sseEmitter.emit({ type: sseType, data: { path: relPath } });
    } catch {
      // 文件读取失败时静默忽略（可能是临时状态）
    }
  }

  /** 从章节 Markdown 中提取标题（首行 # 标题或空） */
  private extractChapterTitle(content: string): string {
    const firstLine = content.split('\n')[0]?.trim() ?? '';
    if (firstLine.startsWith('# ')) return firstLine.slice(2).trim();
    return firstLine || 'Untitled';
  }

  /** 从知识库 JSON 中提取 title 和内容摘要 */
  private extractKnowledge(raw: string): { title: string; content: string } {
    try {
      const data = JSON.parse(raw);
      const title = data.name || data.title || 'Untitled';
      const content =
        typeof data.description === 'string'
          ? data.description
          : JSON.stringify(data);
      return { title, content };
    } catch {
      return { title: 'Untitled', content: raw };
    }
  }
}
