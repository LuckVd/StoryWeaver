import type {
  ChapterSummary,
  Timeline,
  TimelineItem,
  CharacterStates,
  CharacterState,
  CharacterStateEntry,
} from '../models/memory.js';

/**
 * 记忆派生聚合器
 *
 * 从已入库的 ChapterSummary 确定性聚合出「时间线」与「角色状态变迁」。
 * 纯函数、无 IO、无副作用 —— 供发布流程在章节摘要生成后重建派生记忆视图。
 *
 * 不调用 LLM：数据源已存在于每章 ChapterSummary 的 plotEvents / stateChanges /
 * narrativeTime 字段中，聚合即可得到稳定结果。
 */

/** 按 chapter 升序拷贝（不修改入参） */
function sortByChapter<T extends { chapter: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.chapter - b.chapter);
}

/**
 * 聚合时间线：按章节号升序，每章映射成一个 TimelineItem。
 */
export function aggregateTimeline(summaries: ChapterSummary[]): Timeline {
  const entries: TimelineItem[] = sortByChapter(summaries).map((s) => ({
    chapter: s.chapter,
    volume: s.volume,
    title: s.title,
    ...(s.narrativeTime !== undefined && s.narrativeTime !== ''
      ? { narrativeTime: s.narrativeTime }
      : {}),
    events: s.plotEvents,
    outcome: s.plotOutcome,
  }));
  return { entries, updatedAt: new Date().toISOString() };
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
