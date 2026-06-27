import { cp, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { LibraryStorage, novelYamlPath, BookStorage } from '@storyweaver/core';

/** 单书时代的书级数据目录(均相对 projectRoot) */
const BOOK_DATA_DIRS = ['volumes', 'knowledge', 'memory', 'reviews', 'workspace'];

/**
 * 首次迁移:把单书时代的 projectRoot 数据迁入书架第一本。
 *
 * 触发条件:书架为空 且 源目录存在 novel.yaml。
 * 幂等:书架非空则跳过(已迁移过)。源数据保留(不删,作备份)。
 * memory/.cache(SQLite 缓存,可重建)排除不迁。
 *
 * @returns 迁移新建的 slug;无需迁移返回 null
 */
export async function migrateLegacyBookIfNeeded(
  sourceProjectRoot: string,
  libraryStorage: LibraryStorage,
): Promise<string | null> {
  // 书架已有书 → 已迁移过
  const existing = await libraryStorage.list();
  if (existing.length > 0) return null;

  const sourceYaml = novelYamlPath(sourceProjectRoot);
  try {
    await access(sourceYaml, constants.R_OK);
  } catch {
    return null; // 源无 novel.yaml,无需迁移
  }

  const book = await new BookStorage(sourceProjectRoot).read();
  if (!book) return null;

  const slug = await libraryStorage.generateSlug();
  const dest = libraryStorage.bookPath(slug);
  await mkdir(dest, { recursive: true });

  // 复制 novel.yaml
  await cp(sourceYaml, novelYamlPath(dest));

  // 复制各书级数据目录(忽略不存在的;memory/.cache 排除)
  for (const dir of BOOK_DATA_DIRS) {
    const src = join(sourceProjectRoot, dir);
    try {
      await access(src, constants.R_OK);
    } catch {
      continue;
    }
    const dst = join(dest, dir);
    if (dir === 'memory') {
      await cp(src, dst, {
        recursive: true,
        filter: (s: string) => !s.includes('.cache'),
      });
    } else {
      await cp(src, dst, { recursive: true });
    }
  }

  await libraryStorage.setCurrent(slug);
  console.log(`[migrate] 已将单书数据迁移为书架第一本:${book.title} → ${slug} (${dest})`);
  return slug;
}
