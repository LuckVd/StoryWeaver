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
    const summariesDir = path.join(this.projectRoot, 'memory', 'summaries');

    this.watcher = watch([volumesDir, knowledgeDir, summariesDir], {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath: string) => this.handleEvent('add', filePath));
    this.watcher.on('change', (filePath: string) => this.handleEvent('change', filePath));
    this.watcher.on('unlink', (filePath: string) => this.handleEvent('unlink', filePath));

    // 启动加载(G04-S03):优先从持久化索引缓存恢复(不扫文件);
    // 缓存为空时扫文件构建,且 index 自动双写填充缓存,供下次启动恢复。
    if (this.searchEngine.storeSize > 0) {
      const n = this.searchEngine.loadFromStore();
      console.log(`[fileWatcher] 从缓存恢复索引，共 ${n} 个文档`);
    } else {
      Promise.all([this.indexExisting(volumesDir), this.indexExisting(knowledgeDir), this.indexExisting(summariesDir)])
        .then(() => console.log(`[fileWatcher] 初始索引完成，共 ${this.searchEngine.size} 个文档`))
        .catch((e) => console.error('[fileWatcher] 初始索引失败:', e));
    }
  }

  /** 递归扫描目录，把现有文件全部索引进搜索引擎 */
  private async indexExisting(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // 目录不存在
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.indexExisting(full);
      } else if (entry.isFile()) {
        await this.handleEvent('add', full);
      }
    }
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
        const title = await this.resolveChapterTitle(relPath, content);
        this.searchEngine.updateChapter(parseInt(parsed.id, 10), title, content);
      } else if (parsed.type === 'knowledge') {
        const { title, content: summary } = this.extractKnowledge(content);
        this.searchEngine.updateKnowledge(parsed.id, title, summary);
      } else if (parsed.type === 'summary') {
        const sum = this.extractSummary(content);
        if (sum) this.searchEngine.updateSummary(parseInt(parsed.id, 10), sum.title, sum.content);
      }

      const sseType = event === 'add' ? 'file:added' : 'file:changed';
      this.sseEmitter.emit({ type: sseType, data: { path: relPath } });
    } catch {
      // 文件读取失败时静默忽略（可能是临时状态）
    }
  }

  /** 解析章节真章名：优先读卷索引 index.json 的 meta.title，缺失则回退正文首句 */
  private async resolveChapterTitle(relPath: string, content: string): Promise<string> {
    const m = relPath.match(/volumes[/\\]v(\d+)[/\\]ch(\d+)\.md$/);
    if (m) {
      try {
        const indexPath = path.join(
          this.projectRoot,
          'volumes',
          `v${String(parseInt(m[1], 10)).padStart(2, '0')}`,
          'index.json',
        );
        const raw = await fs.readFile(indexPath, 'utf-8');
        const metas: Array<{ id: number; title: string }> = JSON.parse(raw);
        const meta = metas.find((x) => x.id === parseInt(m[2], 10));
        if (meta?.title) return meta.title;
      } catch {
        // 卷索引缺失或解析失败 → 回退正文首句
      }
    }
    return this.extractChapterTitle(content);
  }

  /** 从章节内容提取标题片段：优先 markdown 首行标题，否则 HTML 去标签取首句，截断 50 字 */
  private extractChapterTitle(content: string): string {
    // 去 HTML 标签
    const stripped = content.replace(/<[^>]+>/g, ' ');
    const firstLine = stripped.split('\n')[0]?.trim() ?? '';
    if (!firstLine) {
      const text = stripped.replace(/\s+/g, ' ').trim();
      return text ? text.slice(0, 50) : 'Untitled';
    }
    // markdown heading：# 标题 / ## 标题 …
    const heading = firstLine.match(/^#{1,6}\s+(.+)/);
    if (heading) {
      return heading[1].trim().slice(0, 50);
    }
    const firstSentence = firstLine.split(/[。!?！？]/)[0]?.trim() ?? firstLine;
    return firstSentence.slice(0, 50) || 'Untitled';
  }

  /** 从知识库 JSON 中提取 title 和可检索内容(拼入 aliases/tags/profile 提升召回) */
  private extractKnowledge(raw: string): { title: string; content: string } {
    try {
      const data = JSON.parse(raw);
      const title = data.name || data.title || 'Untitled';
      // 兼容各实体:Character(description/aliases/profile/tags)、WorldEntry/Rule/Custom(content/tags)、Item/Hook(description)
      const parts: string[] = [];
      if (Array.isArray(data.aliases)) parts.push(data.aliases.join(' '));
      if (Array.isArray(data.tags)) parts.push(data.tags.join(' '));
      if (typeof data.description === 'string') parts.push(data.description);
      else if (typeof data.content === 'string') parts.push(data.content);
      if (typeof data.profile === 'string') parts.push(data.profile);
      const content = parts.filter(Boolean).join(' ') || JSON.stringify(data);
      return { title, content };
    } catch {
      return { title: 'Untitled', content: raw };
    }
  }

  /** 从摘要 JSON 提取标题和可搜索内容 */
  private extractSummary(raw: string): { title: string; content: string } | null {
    try {
      const d = JSON.parse(raw);
      // 章号由前端按 chapterOrder(连续序号)渲染,这里只存纯章名
      const title = d.title ?? '章节摘要';
      const parts = [d.plotOutcome, ...(d.plotEvents ?? []), ...(d.charactersPresent ?? [])].filter(Boolean);
      return { title, content: parts.join(' ') };
    } catch {
      return null;
    }
  }
}
