import { describe, it, expect } from 'vitest';
import { getActiveArc, getArcsFlat } from '../outline-locator.js';
import type { OutlineNode } from '../../models/knowledge.js';

/** 测试大纲:book → 3 个剧情卷(带章节范围)+ 一个大事件 */
function buildTree(): OutlineNode {
  return {
    id: 'root',
    type: 'book',
    title: '测试书',
    sortOrder: 0,
    children: [
      {
        id: 'a1',
        type: 'arc',
        title: '第一卷·崛起',
        summary: '觉醒',
        chapterRange: [1, 14],
        sortOrder: 0,
        children: [
          { id: 'm1', type: 'milestone', title: '觉醒', summary: '获得能力', sortOrder: 0 },
        ],
      },
      {
        id: 'a2',
        type: 'arc',
        title: '第二卷·抗争',
        summary: '冲突',
        chapterRange: [15, 40],
        sortOrder: 1,
      },
      {
        id: 'a3',
        type: 'arc',
        title: '第三卷·陨落',
        summary: '重生',
        chapterRange: [41, 60],
        sortOrder: 2,
      },
    ],
  };
}

describe('outline-locator', () => {
  describe('getArcsFlat', () => {
    it('收集所有 arc 节点并按 sortOrder 升序', () => {
      expect(getArcsFlat(buildTree()).map((n) => n.id)).toEqual(['a1', 'a2', 'a3']);
    });

    it('跳过 book/milestone 节点', () => {
      expect(getArcsFlat(buildTree()).every((n) => n.type === 'arc')).toBe(true);
    });

    it('空树 / null 返回空数组', () => {
      expect(getArcsFlat(null)).toEqual([]);
      expect(getArcsFlat({ id: 'x', type: 'book', title: 't', sortOrder: 0 })).toEqual([]);
    });
  });

  describe('getActiveArc', () => {
    it('落在某卷范围内 → current=该卷, next=下一卷', () => {
      const r = getActiveArc(buildTree(), 20);
      expect(r.current?.id).toBe('a2');
      expect(r.next?.id).toBe('a3');
    });

    it('范围边界(起始/结束)算命中', () => {
      expect(getActiveArc(buildTree(), 15).current?.id).toBe('a2'); // a2 起始
      expect(getActiveArc(buildTree(), 40).current?.id).toBe('a2'); // a2 结束
      expect(getActiveArc(buildTree(), 14).current?.id).toBe('a1'); // a1 结束
    });

    it('最后一卷无 next', () => {
      const r = getActiveArc(buildTree(), 50);
      expect(r.current?.id).toBe('a3');
      expect(r.next).toBeNull();
    });

    it('落在间隙(已超 a1 范围、未到 a2 起始)→ fallback 当前=a1, next=a2', () => {
      const tree: OutlineNode = {
        id: 'root',
        type: 'book',
        title: 't',
        sortOrder: 0,
        children: [
          { id: 'a1', type: 'arc', title: '一', chapterRange: [1, 10], sortOrder: 0 },
          { id: 'a2', type: 'arc', title: '二', chapterRange: [20, 30], sortOrder: 1 },
        ],
      };
      const r = getActiveArc(tree, 15);
      expect(r.current?.id).toBe('a1');
      expect(r.next?.id).toBe('a2');
    });

    it('早于所有卷起始 → fallback 当前=第一卷', () => {
      const r = getActiveArc(buildTree(), 0);
      expect(r.current?.id).toBe('a1');
      expect(r.next?.id).toBe('a2');
    });

    it('无任何 arc 带 chapterRange → {null,null}', () => {
      const tree: OutlineNode = {
        id: 'root',
        type: 'book',
        title: 't',
        sortOrder: 0,
        children: [{ id: 'a1', type: 'arc', title: '一', sortOrder: 0 }],
      };
      const r = getActiveArc(tree, 5);
      expect(r.current).toBeNull();
      expect(r.next).toBeNull();
    });

    it('空树 / null → {null,null}', () => {
      expect(getActiveArc(null, 5)).toEqual({ current: null, next: null });
    });
  });
});
