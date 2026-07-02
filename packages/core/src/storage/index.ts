/**
 * 存储层统一导出
 */

export { resolveSafe, ensureDir, volumeDir, chapterPath, volumeIndexPath, novelYamlPath, workspaceJsonPath, parseVolumeNumber, parseChapterId, chapterVersionsDir, versionFilePath, parseVersionId, PathTraversalError, knowledgeDir, knowledgeFilePath, worldFilePath, customFilePath, outlineFilePath, relationsFilePath, characterDir, characterIndexPath, characterFilePath, memoryDir, summariesDir, summaryFilePath, batchSummariesDir, batchSummaryFilePath, storyStateFilePath, characterStatesFilePath } from './path.js';
export { BookStorage } from './book-storage.js';
export { libraryDir, bookDir, currentBookFilePath, globalConfigDir } from './path.js';
export { LibraryStorage } from './library-storage.js';
export { ChapterStorage } from './chapter-storage.js';
export { VolumeIndexStorage } from './volume-index-storage.js';
export { WorkspaceStorage } from './workspace-storage.js';
export { VersionStorage } from './version-storage.js';
export { KnowledgeStorage } from './knowledge-storage.js';
export { OutlineStorage } from './outline-storage.js';
export { RelationStorage } from './relation-storage.js';
export { SummaryStorage } from './summary-storage.js';
export { ConfigStorage } from './config-storage.js';
export { SqliteCache, CACHE_SCHEMA_VERSION, CacheStore, withFallback, rebuildCache } from './cache/index.js';
export type { CacheDoc } from './cache/index.js';
