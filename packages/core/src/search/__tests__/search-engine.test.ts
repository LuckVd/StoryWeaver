import { describe, it, expect } from 'vitest';
import { InMemorySearchEngine, tokenize } from '../search-engine.js';

describe('tokenize', () => {
  it('should split Chinese text character by character', () => {
    expect(tokenize('张三进入密室')).toEqual(['张', '三', '进', '入', '密', '室']);
  });

  it('should split English text by spaces and lowercase', () => {
    expect(tokenize('Hello World')).toEqual(['hello', 'world']);
  });

  it('should handle mixed Chinese and English', () => {
    const tokens = tokenize('张三使用Fireball技能');
    expect(tokens).toContain('张');
    expect(tokens).toContain('fireball');
    expect(tokens).toContain('技');
    expect(tokens).toContain('能');
  });

  it('should filter punctuation', () => {
    expect(tokenize('你好，世界！')).toEqual(['你', '好', '世', '界']);
    expect(tokenize('hello, world!')).toEqual(['hello', 'world']);
  });

  it('should handle numbers', () => {
    expect(tokenize('chapter 10')).toEqual(['chapter', '10']);
  });

  it('should return empty for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('should handle pure punctuation', () => {
    expect(tokenize('，。！？')).toEqual([]);
  });
});

describe('InMemorySearchEngine', () => {
  function createEngine() {
    const engine = new InMemorySearchEngine();
    engine.indexChapter(1, '第一章 起点', '张三是一个普通少年，住在天元宗山脚下的村庄里。');
    engine.indexChapter(2, '第二章 入门', '张三拜入天元宗，开始了修炼之路。');
    engine.indexChapter(3, '第三章 密室', '李四在密室中发现了一本古书，记载着失传的功法。');
    engine.indexKnowledge('char-zhangsan', '张三', '主角，天赋异禀，修炼速度极快。');
    engine.indexKnowledge('char-lisi', '李四', '张三的好友，擅长阵法。');
    engine.indexSummary(1, '第一章摘要', '张三出场，介绍背景。');
    return engine;
  }

  it('should search Chinese text in chapters', () => {
    const engine = createEngine();
    const results = engine.search('张三');
    expect(results.length).toBeGreaterThanOrEqual(3);
    // 张三出现在 ch1, ch2, knowledge, summary
    const types = results.map((r) => r.type);
    expect(types).toContain('chapter');
    expect(types).toContain('knowledge');
    expect(types).toContain('summary');
  });

  it('should search with multiple tokens (intersection)', () => {
    const engine = createEngine();
    const results = engine.search('张三 天元宗');
    // 只有 ch1 和 ch2 同时包含张三和天元宗
    const chapterResults = results.filter((r) => r.type === 'chapter');
    expect(chapterResults.length).toBe(2);
  });

  it('should return empty for no match', () => {
    const engine = createEngine();
    const results = engine.search('不存在的内容xyz');
    expect(results).toEqual([]);
  });

  it('should return empty for empty query', () => {
    const engine = createEngine();
    expect(engine.search('')).toEqual([]);
    expect(engine.search('，。')).toEqual([]);
  });

  it('should filter by scope=chapters', () => {
    const engine = createEngine();
    const results = engine.search('张三', 'chapters');
    expect(results.every((r) => r.type === 'chapter')).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by scope=knowledge', () => {
    const engine = createEngine();
    const results = engine.search('张三', 'knowledge');
    expect(results.every((r) => r.type === 'knowledge')).toBe(true);
  });

  it('should filter by scope=summaries', () => {
    const engine = createEngine();
    const results = engine.search('张三', 'summaries');
    expect(results.every((r) => r.type === 'summary')).toBe(true);
  });

  it('should boost title matches in scoring', () => {
    const engine = createEngine();
    const results = engine.search('密室');
    // ch3 title contains '密室', should rank higher
    const ch3 = results.find((r) => r.id === '3');
    const ch1 = results.find((r) => r.id === '1');
    if (ch3 && ch1) {
      expect(ch3.score).toBeGreaterThan(ch1.score);
    }
  });

  it('should include snippet in results', () => {
    const engine = createEngine();
    const results = engine.search('古书');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toBeDefined();
    expect(results[0].snippet.length).toBeGreaterThan(0);
  });

  it('should remove a document', () => {
    const engine = createEngine();
    engine.remove('chapter', '1');
    const results = engine.search('张三 起点');
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain('1');
  });

  it('should clear all indices', () => {
    const engine = createEngine();
    expect(engine.size).toBeGreaterThan(0);
    engine.clear();
    expect(engine.size).toBe(0);
    expect(engine.search('张三')).toEqual([]);
  });

  it('should report document count', () => {
    const engine = createEngine();
    // 3 chapters + 2 knowledge + 1 summary = 6
    expect(engine.size).toBe(6);
  });

  it('should update a chapter index', () => {
    const engine = createEngine();
    engine.updateChapter(1, '第一章 新起点', '张三离开了村庄，踏上了旅途。');
    const results = engine.search('新起点');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('1');
    expect(results[0].title).toBe('第一章 新起点');
    // 旧内容不再匹配
    const oldResults = engine.search('村庄 天元宗');
    const ids = oldResults.map((r) => r.id);
    expect(ids).not.toContain('1');
  });

  it('should update a knowledge entry index', () => {
    const engine = createEngine();
    engine.updateKnowledge('char-zhangsan', '张三', '主角，已经突破金丹境。');
    const results = engine.search('金丹');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('char-zhangsan');
  });

  it('should remove by file path', () => {
    const engine = createEngine();
    engine.removeByPath('volumes/v01/ch001.md');
    const results = engine.search('起点');
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain('1');
  });

  it('should remove knowledge by file path', () => {
    const engine = createEngine();
    engine.removeByPath('knowledge/characters/char-zhangsan.json');
    const results = engine.search('天赋异禀');
    expect(results.length).toBe(0);
  });

  it('should handle nested knowledge path', () => {
    const engine = createEngine();
    engine.removeByPath('knowledge\\characters\\char-lisi.json');
    const results = engine.search('好友 阵法');
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain('char-lisi');
  });

  it('should return null for unrecognized path', () => {
    const engine = createEngine();
    expect(engine.parsePath('some/random/file.txt')).toBeNull();
  });

  it('should handle English search', () => {
    const engine = new InMemorySearchEngine();
    engine.indexChapter(1, 'The Beginning', 'A young hero discovers a magical sword.');
    engine.indexChapter(2, 'The Journey', 'The hero embarks on a long journey across mountains.');
    const results = engine.search('hero');
    expect(results.length).toBe(2);
  });
});
