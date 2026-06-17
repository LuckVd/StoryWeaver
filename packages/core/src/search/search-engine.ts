/**
 * 内存搜索引擎
 *
 * 倒排索引 + 中英文分词，支持按 scope 过滤。
 * 启动时从文件系统构建索引，微秒~毫秒级搜索。
 */

/** 搜索结果 */
export interface SearchResult {
  type: 'chapter' | 'knowledge' | 'summary';
  id: string;
  title: string;
  snippet: string;
  score: number;
}

/** 内部文档表示 */
interface Document {
  type: 'chapter' | 'knowledge' | 'summary';
  id: string;
  title: string;
  content: string;
}

/** scope 过滤类型 */
export type SearchScope = 'all' | 'chapters' | 'knowledge' | 'summaries';

/** 文档唯一键 */
function docKey(type: string, id: string): string {
  return `${type}:${id}`;
}

/**
 * 简单中英文分词
 *
 * - 中文：逐字分割
 * - 英文：按空格分割 + 小写化
 * - 过滤标点符号
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let buffer = '';

  for (const ch of text) {
    if (/[a-zA-Z0-9]/.test(ch)) {
      buffer += ch.toLowerCase();
    } else if (/[\u4e00-\u9fff]/.test(ch)) {
      // 遇到中文字符：先刷出英文 buffer，再输出中文字
      if (buffer) {
        tokens.push(buffer);
        buffer = '';
      }
      tokens.push(ch);
    } else {
      // 标点/空白：刷出 buffer
      if (buffer) {
        tokens.push(buffer);
        buffer = '';
      }
    }
  }
  if (buffer) {
    tokens.push(buffer);
  }
  return tokens;
}

/** 从内容中提取匹配位置附近的片段 */
function extractSnippet(content: string, queryTokens: string[], maxLen = 120): string {
  if (content.length <= maxLen) return content;

  const lower = content.toLowerCase();
  let bestPos = 0;

  // 找到第一个匹配 token 的位置
  for (const token of queryTokens) {
    const idx = lower.indexOf(token);
    if (idx >= 0) {
      bestPos = idx;
      break;
    }
  }

  // 以匹配位置为中心截取
  const start = Math.max(0, bestPos - 30);
  const end = Math.min(content.length, start + maxLen);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

/**
 * 内存搜索引擎
 *
 * 使用倒排索引实现全文搜索，支持中英文分词。
 */
export class InMemorySearchEngine {
  /** 倒排索引：token → 文档键集合 */
  private wordIndex = new Map<string, Set<string>>();
  /** 文档存储 */
  private documents = new Map<string, Document>();

  /** 索引一个文档 */
  private index(doc: Document): void {
    const key = docKey(doc.type, doc.id);
    this.documents.set(key, doc);

    const tokens = tokenize(doc.title + ' ' + doc.content);
    for (const token of tokens) {
      let set = this.wordIndex.get(token);
      if (!set) {
        set = new Set();
        this.wordIndex.set(token, set);
      }
      set.add(key);
    }
  }

  /** 索引章节 */
  indexChapter(id: number, title: string, content: string): void {
    this.index({ type: 'chapter', id: String(id), title, content: content });
  }

  /** 索引知识库条目 */
  indexKnowledge(id: string, title: string, content: string): void {
    this.index({ type: 'knowledge', id, title, content: content });
  }

  /** 索引摘要 */
  indexSummary(chapter: number, title: string, content: string): void {
    this.index({ type: 'summary', id: String(chapter), title, content: content });
  }

  /** 更新已有章节索引（先移除再重新索引） */
  updateChapter(id: number, title: string, content: string): void {
    this.remove('chapter', String(id));
    this.indexChapter(id, title, content);
  }

  /** 更新已有知识库条目索引 */
  updateKnowledge(id: string, title: string, content: string): void {
    this.remove('knowledge', id);
    this.indexKnowledge(id, title, content);
  }

  /** 更新摘要索引 */
  updateSummary(chapter: number, title: string, content: string): void {
    this.remove('summary', String(chapter));
    this.indexSummary(chapter, title, content);
  }

  /** 根据文件路径移除文档 */
  removeByPath(filePath: string): void {
    const parsed = this.parsePath(filePath);
    if (!parsed) return;
    this.remove(parsed.type, parsed.id);
  }

  /** 解析文件路径，提取类型和 ID */
  parsePath(filePath: string): { type: string; id: string } | null {
    // volumes/v01/ch001.md → chapter, 1 (标准化为数字 ID)
    const chapterMatch = filePath.match(/volumes[/\\]v\d+[/\\]ch(\d+)\.md$/);
    if (chapterMatch) {
      return { type: 'chapter', id: String(parseInt(chapterMatch[1], 10)) };
    }
    // knowledge/characters/xxx.json → knowledge, xxx (仅取文件名作为 ID)
    const knowledgeMatch = filePath.match(/knowledge[/\\].*[/\\]([^/\\]+)\.json$/);
    if (knowledgeMatch) {
      return { type: 'knowledge', id: knowledgeMatch[1] };
    }
    // knowledge/xxx.json (flat) → knowledge, xxx
    const knowledgeFlatMatch = filePath.match(/knowledge[/\\]([^/\\]+)\.json$/);
    if (knowledgeFlatMatch) {
      return { type: 'knowledge', id: knowledgeFlatMatch[1] };
    }
    // memory/summaries/chXXX.json → summary, chapterId
    const summaryMatch = filePath.match(/summaries[/\\]ch(\d+)\.json$/);
    if (summaryMatch) {
      return { type: 'summary', id: summaryMatch[1] };
    }
    return null;
  }

  /** 移除文档 */
  remove(type: string, id: string): void {
    const key = docKey(type, id);
    const doc = this.documents.get(key);
    if (!doc) return;

    // 从倒排索引中移除
    const tokens = tokenize(doc.title + ' ' + doc.content);
    for (const token of tokens) {
      const set = this.wordIndex.get(token);
      if (set) {
        set.delete(key);
        if (set.size === 0) {
          this.wordIndex.delete(token);
        }
      }
    }
    this.documents.delete(key);
  }

  /** 清空所有索引 */
  clear(): void {
    this.wordIndex.clear();
    this.documents.clear();
  }

  /** 搜索 */
  search(query: string, scope: SearchScope = 'all'): SearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    // 计算每个 token 匹配的文档集合
    const docSets: Set<string>[] = [];
    for (const token of queryTokens) {
      const matched = this.wordIndex.get(token);
      if (!matched) return []; // 任一 token 无匹配则无结果
      docSets.push(matched);
    }

    // 取交集
    let intersection = docSets[0];
    for (let i = 1; i < docSets.length; i++) {
      intersection = new Set([...intersection].filter((x) => docSets[i].has(x)));
    }

    // scope 过滤 + 评分
    const results: SearchResult[] = [];
    for (const key of intersection) {
      const doc = this.documents.get(key);
      if (!doc) continue;

      // scope 过滤
      if (scope !== 'all') {
        const scopeMap: Record<string, string> = {
          chapters: 'chapter',
          knowledge: 'knowledge',
          summaries: 'summary',
        };
        if (doc.type !== scopeMap[scope]) continue;
      }

      // 评分：匹配 token 数 * 标题匹配加分
      let score = queryTokens.length;
      const titleTokens = tokenize(doc.title);
      for (const qt of queryTokens) {
        if (titleTokens.includes(qt)) score += 2;
      }

      results.push({
        type: doc.type,
        id: doc.id,
        title: doc.title,
        snippet: extractSnippet(doc.content, queryTokens),
        score,
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /** 当前索引文档数 */
  get size(): number {
    return this.documents.size;
  }
}
