/**
 * 存储层统一导出
 */

export { resolveSafe, ensureDir, volumeDir, chapterPath, volumeIndexPath, novelYamlPath, workspaceJsonPath, parseVolumeNumber, parseChapterId, PathTraversalError } from './path.js';
export { BookStorage } from './book-storage.js';
export { ChapterStorage } from './chapter-storage.js';
export { VolumeIndexStorage } from './volume-index-storage.js';
export { WorkspaceStorage } from './workspace-storage.js';
