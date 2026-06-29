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
    it('落在某卷范围内 → current=该卷, upcoming[0]=下一卷', () => {
      const r = getActiveArc(buildTree(), 20);
      expect(r.current?.id).toBe('a2');
      expect(r.upcoming.map((n) => n.id)).toEqual(['a3']);
    });

    it('范围边界(起始/结束)算命中', () => {
      expect(getActiveArc(buildTree(), 15).current?.id).toBe('a2'); // a2 起始
      expect(getActiveArc(buildTree(), 40).current?.id).toBe('a2'); // a2 结束
      expect(getActiveArc(buildTree(), 14).current?.id).toBe('a1'); // a1 结束
    });

    it('最后一卷 → upcoming 为空', () => {
      const r = getActiveArc(buildTree(), 50);
      expect(r.current?.id).toBe('a3');
      expect(r.upcoming).toEqual([]);
    });

    it('落在间隙(已超 a1,未到 a2)→ current=a1, upcoming=[a2]', () => {
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
      expect(r.upcoming.map((n) => n.id)).toEqual(['a2']);
    });

    it('早于所有卷起始 → current=第一卷, upcoming=其余全部', () => {
      const r = getActiveArc(buildTree(), 0);
      expect(r.current?.id).toBe('a1');
      expect(r.upcoming.map((n) => n.id)).toEqual(['a2', 'a3']);
    });

    it('单个未绑定卷(纯规划)→ current=该卷, upcoming 空', () => {
      const tree: OutlineNode = {
        id: 'root',
        type: 'book',
        title: 't',
        sortOrder: 0,
        children: [{ id: 'a1', type: 'arc', title: '一', sortOrder: 0 }],
      };
      const r = getActiveArc(tree, 5);
      expect(r.current?.id).toBe('a1');
      expect(r.upcoming).toEqual([]);
    });

    it('空树 / null → {current:null, upcoming:[]}', () => {
      expect(getActiveArc(null, 5)).toEqual({ current: null, upcoming: [] });
    });

    it('尾卷开放(无结束章):写在其起始后 → current=该卷, upcoming 空', () => {
      const tree: OutlineNode = {
        id: 'root',
        type: 'book',
        title: 't',
        sortOrder: 0,
        children: [
          { id: 'a1', type: 'arc', title: '一', chapterRange: [1, 14], sortOrder: 0 },
          { id: 'a2', type: 'arc', title: '二', chapterRange: [15, 40], sortOrder: 1 },
          { id: 'a3', type: 'arc', title: '三', chapterRange: [41], sortOrder: 2 },
        ],
      };
      expect(getActiveArc(tree, 50).current?.id).toBe('a3');
      expect(getActiveArc(tree, 50).upcoming).toEqual([]);
      // 远超任何卷,仍被开放尾卷吞掉
      expect(getActiveArc(tree, 999).current?.id).toBe('a3');
    });

    it('中间卷开放:被起始更靠后的有界卷覆盖时取后者', () => {
      const tree: OutlineNode = {
        id: 'root',
        type: 'book',
        title: 't',
        sortOrder: 0,
        children: [
          { id: 'a1', type: 'arc', title: '一', chapterRange: [1], sortOrder: 0 }, // 开放
          { id: 'a2', type: 'arc', title: '二', chapterRange: [5, 10], sortOrder: 1 },
        ],
      };
      // ch=7 同时被 a1(开放)与 a2[5,10] 覆盖 → 取更具体的 a2
      expect(getActiveArc(tree, 7).current?.id).toBe('a2');
      // ch=3 只被 a1(开放)覆盖
      const r3 = getActiveArc(tree, 3);
      expect(r3.current?.id).toBe('a1');
      expect(r3.upcoming.map((n) => n.id)).toEqual(['a2']);
    });

    it('全有界、写到所有卷之后 → current=最后一卷, upcoming 空', () => {
      expect(getActiveArc(buildTree(), 100).current?.id).toBe('a3');
      expect(getActiveArc(buildTree(), 100).upcoming).toEqual([]);
    });

    it('未绑定的未来卷出现在 upcoming(后续规划)', () => {
      const tree: OutlineNode = {
        id: 'root',
        type: 'book',
        title: 't',
        sortOrder: 0,
        children: [
          { id: 'a1', type: 'arc', title: '一', chapterRange: [1, 10], sortOrder: 0 },
          { id: 'a2', type: 'arc', title: '二', sortOrder: 1 }, // 未绑定
          { id: 'a3', type: 'arc', title: '三', sortOrder: 2 }, // 未绑定
        ],
      };
      const r = getActiveArc(tree, 5);
      expect(r.current?.id).toBe('a1');
      expect(r.upcoming.map((n) => n.id)).toEqual(['a2', 'a3']);
    });

    it('全部未绑定(纯规划)→ current=第一卷, 其余入 upcoming', () => {
      const tree: OutlineNode = {
        id: 'root',
        type: 'book',
        title: 't',
        sortOrder: 0,
        children: [
          { id: 'a1', type: 'arc', title: '一', sortOrder: 0 },
          { id: 'a2', type: 'arc', title: '二', sortOrder: 1 },
          { id: 'a3', type: 'arc', title: '三', sortOrder: 2 },
        ],
      };
      const r = getActiveArc(tree, 5);
      expect(r.current?.id).toBe('a1');
      expect(r.upcoming.map((n) => n.id)).toEqual(['a2', 'a3']);
    });

    it('upcoming 上限 5(超出截断)', () => {
      const tree: OutlineNode = {
        id: 'root',
        type: 'book',
        title: 't',
        sortOrder: 0,
        children: Array.from({ length: 8 }, (_, i) => ({
          id: `a${i}`,
          type: 'arc' as const,
          title: `卷${i}`,
          sortOrder: i,
        })),
      };
      const r = getActiveArc(tree, 1); // 全未绑定 → current=a0
      expect(r.upcoming).toHaveLength(5);
      expect(r.upcoming[0].id).toBe('a1');
      expect(r.upcoming[4].id).toBe('a5');
    });
  });
});
