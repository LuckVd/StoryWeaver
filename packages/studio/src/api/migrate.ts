import { cp, mkdir, access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { LibraryStorage, novelYamlPath, BookStorage, globalConfigDir } from '@storyweaver/core';

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

/**
 * 迁移书级模型配置到全局(模型配置全局化,与书无关)。
 *
 * 模型配置原先落在每本书的 config/models.json 下,现统一存全局
 * ~/.storyweaver/config/models.json(跨书共享,空书架也可配)。
 *
 * 触发条件:全局 models.json 不存在。遍历书架,把第一本含非空 config/models.json
 * 的书级配置复制到全局。幂等:全局已存在则跳过。书级源文件保留(不删,作备份)。
 *
 * @returns 是否执行了迁移
 */
export async function migrateModelsToGlobal(libraryStorage: LibraryStorage): Promise<boolean> {
  const globalFile = resolve(globalConfigDir(), 'models.json');
  try {
    await access(globalFile, constants.R_OK);
    return false; // 全局已存在,无需迁移
  } catch {
    // 全局不存在,继续查找书级配置
  }
  const books = await libraryStorage.list();
  for (const book of books) {
    const bookConfigFile = resolve(libraryStorage.bookPath(book.slug), 'config', 'models.json');
    try {
      const parsed = JSON.parse(await readFile(bookConfigFile, 'utf-8'));
      if (parsed && Array.isArray(parsed.models) && parsed.models.length > 0) {
        await mkdir(globalConfigDir(), { recursive: true });
        await writeFile(globalFile, JSON.stringify(parsed, null, 2), 'utf-8');
        console.log(`[migrate] 已将书级模型配置迁移到全局:${book.slug} → ${globalFile}`);
        return true;
      }
    } catch {
      // 该书无配置或读取失败,继续下一本
    }
  }
  return false;
}
