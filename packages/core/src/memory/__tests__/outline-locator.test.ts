import { describe, it, expect } from 'vitest';
import {
  getChapterNodesFlat,
  findOutlineNodeByChapterId,
  getOutlineNeighbors,
} from '../outline-locator.js';
import type { OutlineNode } from '../../models/knowledge.js';

/** 测试大纲:book → 2 卷,每卷 2 章,共 4 章(验证跨卷定位) */
function buildTree(): OutlineNode {
  return {
    id: 'root',
    type: 'book',
    title: '测试书',
    sortOrder: 0,
    children: [
      {
        id: 'v1',
        type: 'volume',
        title: '第一卷',
        sortOrder: 0,
        children: [
          { id: 'c1', type: 'chapter', title: '第一章', chapterId: 1, summary: '开篇', sortOrder: 0 },
          { id: 'c2', type: 'chapter', title: '第二章', chapterId: 2, summary: '入门', sortOrder: 1 },
        ],
      },
      {
        id: 'v2',
        type: 'volume',
        title: '第二卷',
        sortOrder: 1,
        children: [
          { id: 'c3', type: 'chapter', title: '第三章', chapterId: 3, summary: '冲突', sortOrder: 2 },
          { id: 'c4', type: 'chapter', title: '第四章', chapterId: 4, summary: '高潮', sortOrder: 3 },
        ],
      },
    ],
  };
}

describe('outline-locator', () => {
  describe('getChapterNodesFlat', () => {
    it('收集所有 chapter 节点并按 sortOrder 升序', () => {
      const flat = getChapterNodesFlat(buildTree());
      expect(flat.map((n) => n.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    });

    it('跳过 book/volume 节点', () => {
      const flat = getChapterNodesFlat(buildTree());
      expect(flat.every((n) => n.type === 'chapter')).toBe(true);
    });

    it('空树 / null 返回空数组', () => {
      expect(getChapterNodesFlat(null)).toEqual([]);
      expect(getChapterNodesFlat({ id: 'x', type: 'book', title: 't', sortOrder: 0 })).toEqual([]);
    });
  });

  describe('findOutlineNodeByChapterId', () => {
    it('精确匹配 chapterId', () => {
      expect(findOutlineNodeByChapterId(buildTree(), 3)?.id).toBe('c3');
    });

    it('跨卷查找', () => {
      expect(findOutlineNodeByChapterId(buildTree(), 4)?.id).toBe('c4');
    });

    it('未匹配返回 null', () => {
      expect(findOutlineNodeByChapterId(buildTree(), 99)).toBeNull();
    });

    it('null root 返回 null', () => {
      expect(findOutlineNodeByChapterId(null, 1)).toBeNull();
    });
  });

  describe('getOutlineNeighbors', () => {
    it('返回当前节点 + 前后相邻(跨卷)', () => {
      const r = getOutlineNeighbors(buildTree(), 3);
      expect(r.current?.id).toBe('c3');
      expect(r.before.map((n) => n.id)).toEqual(['c2']);
      expect(r.after.map((n) => n.id)).toEqual(['c4']);
    });

    it('第一章无 before', () => {
      const r = getOutlineNeighbors(buildTree(), 1);
      expect(r.current?.id).toBe('c1');
      expect(r.before).toEqual([]);
      expect(r.after.map((n) => n.id)).toEqual(['c2']);
    });

    it('最后一章无 after', () => {
      expect(getOutlineNeighbors(buildTree(), 4).after).toEqual([]);
    });

    it('自定义 before/after 数量', () => {
      const r = getOutlineNeighbors(buildTree(), 3, 2, 1);
      expect(r.before.map((n) => n.id)).toEqual(['c1', 'c2']);
    });

    it('当前章不在大纲 → current=null,前后空', () => {
      const r = getOutlineNeighbors(buildTree(), 99);
      expect(r.current).toBeNull();
      expect(r.before).toEqual([]);
      expect(r.after).toEqual([]);
    });
  });
});
