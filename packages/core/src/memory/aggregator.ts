import type {
  ChapterSummary,
  CharacterStates,
  CharacterState,
  CharacterStateEntry,
  HookTracking,
  HookMention,
} from '../models/memory.js';
import type { Hook } from '../models/knowledge.js';

/**
 * 记忆派生聚合器
 *
 * 从已入库的 ChapterSummary + 知识库实体确定性聚合「角色状态变迁」与「伏笔追踪」。
 * 纯函数、无 IO、无副作用 —— 供发布流程在章节摘要生成后重建派生记忆视图。
 *
 * 不调用 LLM：数据源已存在于每章 ChapterSummary 的 stateChanges / hooksPlanted /
 * hooksAdvanced 字段 + 知识库 Hook 实体，聚合即可得到稳定结果。
 */

/** 按 chapter 升序拷贝（不修改入参） */
function sortByChapter<T extends { chapter: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.chapter - b.chapter);
}

/**
 * 聚合角色状态变迁：遍历各章 stateChanges，按 entity 分组。
 * - currentState：每个 field 取「最后一次」出现的 to（按 chapter 升序遍历保证）
 * - history：保留全部变迁，按 chapter 升序
 * - 结果按 entity 名排序
 */
export function aggregateCharacterStates(summaries: ChapterSummary[]): CharacterStates {
  const map = new Map<string, CharacterState>();

  for (const s of sortByChapter(summaries)) {
    for (const change of s.stateChanges) {
      let entry = map.get(change.entity);
      if (!entry) {
        entry = { entity: change.entity, currentState: {}, history: [] };
        map.set(change.entity, entry);
      }
      const historyEntry: CharacterStateEntry = {
        chapter: s.chapter,
        field: change.field,
        from: change.from,
        to: change.to,
      };
      entry.history.push(historyEntry);
      entry.currentState[change.field] = change.to;
    }
  }

  const characters = [...map.values()].sort((a, b) => a.entity.localeCompare(b.entity, 'zh'));
  return { characters, updatedAt: new Date().toISOString() };
}

/**
 * 聚合伏笔追踪：每个 Hook 实体 + 章节摘要的 hooksPlanted/hooksAdvanced 聚合出追踪视图。
 * - mentions：该伏笔在各章的出现（planted/advanced），按章节升序
 * - lastMention：最后出现章（无则用 plantedAt）
 * - silentChapters：currentChapter - lastMention（沉默章数）
 * - 结果按沉默章数降序（沉默久者优先，提示作者回收）
 *
 * 不受回忆/穿越影响（按章节序聚合，不涉及故事内时间）。
 */
export function aggregateHooksTracking(
  hooks: Hook[],
  summaries: ChapterSummary[],
  currentChapter: number,
): HookTracking[] {
  const sorted = sortByChapter(summaries);
  return hooks
    .map((h) => {
      const mentions: HookMention[] = [];
      for (const s of sorted) {
        if (s.hooksPlanted.includes(h.name)) {
          mentions.push({ chapter: s.chapter, type: 'planted' });
        }
        if (s.hooksAdvanced.includes(h.name)) {
          mentions.push({ chapter: s.chapter, type: 'advanced' });
        }
      }
      const lastMention = mentions.length
        ? Math.max(...mentions.map((m) => m.chapter))
        : h.plantedAt;
      return {
        name: h.name,
        status: h.status,
        description: h.description,
        plantedAt: h.plantedAt,
        mentions: mentions.sort((a, b) => a.chapter - b.chapter),
        lastMention,
        silentChapters: Math.max(0, currentChapter - lastMention),
      };
    })
    .sort((a, b) => b.silentChapters - a.silentChapters);
}
