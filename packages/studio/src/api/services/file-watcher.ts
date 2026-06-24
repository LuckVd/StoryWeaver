/**
 * 文件监听服务
 *
 * 使用 chokidar 监听 volumes/ 和 knowledge/ 目录，
 * 文件变化时增量更新 SearchEngine 索引并广播 SSE 事件。
 */

import { watch, type FSWatcher } from 'chokidar';
import fs from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
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

    // 启动加载(G04-S03 + A7 mtime 校验)：见 bootIndex
    void this.bootIndex(volumesDir, knowledgeDir, summariesDir);
  }

  /**
   * 启动索引加载（A7 mtime 校验）：
   * 优先从持久化缓存恢复，但先比对被监听文件的 mtime 指纹——若进程停机期间
   * 文件被外部编辑器改动，指纹不一致则放弃缓存、重新扫文件构建，避免脏读。
   */
  private async bootIndex(volumesDir: string, knowledgeDir: string, summariesDir: string): Promise<void> {
    const currentFp = this.computeFingerprint([volumesDir, knowledgeDir, summariesDir]);
    const cachedFp = this.searchEngine.getCacheFingerprint();
    if (this.searchEngine.storeSize > 0 && cachedFp !== null && cachedFp === currentFp) {
      const n = this.searchEngine.loadFromStore();
      console.log(`[fileWatcher] 从缓存恢复索引（mtime 指纹一致），共 ${n} 个文档`);
      return;
    }
    // 缓存为空 或 文件有外部变更（指纹不一致）→ 清缓存并扫文件重建
    this.searchEngine.clear();
    try {
      await Promise.all([
        this.indexExisting(volumesDir),
        this.indexExisting(knowledgeDir),
        this.indexExisting(summariesDir),
      ]);
      this.searchEngine.setCacheFingerprint(currentFp);
      console.log(`[fileWatcher] 初始索引完成（已更新 mtime 指纹），共 ${this.searchEngine.size} 个文档`);
    } catch (e) {
      console.error('[fileWatcher] 初始索引失败:', e instanceof Error ? e.message : e);
    }
  }

  /**
   * 计算被监听文件的 mtime 指纹（"相对路径:mtimeMs" 排序拼接）。
   * 只 stat 不读内容，速度远快于全量索引；只纳入可被索引的文件（parsePath 命中）。
   */
  private computeFingerprint(dirs: string[]): string {
    const entries: string[] = [];
    for (const dir of dirs) this.collectMtimes(dir, entries);
    entries.sort();
    return entries.join('|');
  }

  /** 递归收集目录下可索引文件的 "相对路径:mtimeMs"（同步，启动一次性调用） */
  private collectMtimes(dir: string, out: string[]): void {
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // 目录不存在
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.collectMtimes(full, out);
      } else if (entry.isFile()) {
        const relPath = path.relative(this.projectRoot, full);
        if (!this.searchEngine.parsePath(relPath)) continue; // 非可索引文件不纳入指纹
        try {
          const st = statSync(full);
          out.push(`${relPath}:${st.mtimeMs}`);
        } catch {
          // 文件在 stat 前消失等，忽略
        }
      }
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
        const title = this.extractChapterTitle(content);
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

  /** 从摘要 JSON 提取标题和可搜索内容 */
  private extractSummary(raw: string): { title: string; content: string } | null {
    try {
      const d = JSON.parse(raw);
      const title = d.title ? `第${d.chapter}章·${d.title}` : `第${d.chapter}章 摘要`;
      const parts = [d.plotOutcome, ...(d.plotEvents ?? []), ...(d.charactersPresent ?? [])].filter(Boolean);
      return { title, content: parts.join(' ') };
    } catch {
      return null;
    }
  }
}
