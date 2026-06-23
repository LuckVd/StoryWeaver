import type { CacheStore } from './cache-store.js';

/**
 * 缓存一致性辅助函数
 *
 * 文件是唯一主存储,缓存只是加速。这里提供两个核心机制:
 * - withFallback:缓存读失败(或缺失)时降级到文件读,保证正确性永不受缓存故障影响;
 * - rebuildCache:从文件全量重建某 scope 的缓存(缓存缺失 / 损坏 / 版本升级时用)。
 */

/**
 * 先尝试缓存读;返回 null/undefined 或抛错则降级到 fileRead。
 *
 * 缓存层任何异常都不应阻断业务 —— 文件始终可读。
 */
export async function withFallback<T>(
  cacheRead: () => T | null | undefined,
  fileRead: () => Promise<T>,
): Promise<T> {
  try {
    const cached = cacheRead();
    if (cached !== null && cached !== undefined) return cached;
  } catch {
    // 缓存读失败:降级到文件
  }
  return fileRead();
}

/**
 * 从文件全量重建某 scope 的缓存:清空 → 批量写入 loader 提供的文档。
 *
 * @param store 目标 scope 的缓存
 * @param loader 调用方提供的文件枚举器(知道如何从文件加载该 scope 的全部文档)
 * @returns 重建的文档数
 */
export async function rebuildCache(
  store: CacheStore,
  loader: () => Promise<ReadonlyArray<{ key: string; value: string }>>,
): Promise<number> {
  const docs = await loader();
  store.clear();
  store.putMany(docs);
  return docs.length;
}
