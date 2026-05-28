import { describe, it, expect } from 'vitest';
import { resolveSafe, chapterPath, novelYamlPath, workspaceJsonPath, parseVolumeNumber, parseChapterId, memoryDir, summariesDir, summaryFilePath, batchSummariesDir, batchSummaryFilePath, storyStateFilePath } from '../path.js';
import { PathTraversalError } from '../path.js';
import { resolve } from 'node:path';

describe('resolveSafe', () => {
  const root = '/tmp/test-project';

  it('should resolve normal relative paths', () => {
    expect(resolveSafe(root, 'volumes/v01/ch001.md'))
      .toBe(resolve(root, 'volumes/v01/ch001.md'));
  });

  it('should resolve root itself', () => {
    expect(resolveSafe(root, '.')).toBe(resolve(root));
  });

  it('should reject parent traversal', () => {
    expect(() => resolveSafe(root, '../etc/passwd'))
      .toThrow(PathTraversalError);
  });

  it('should reject absolute path outside root', () => {
    expect(() => resolveSafe(root, '/etc/passwd'))
      .toThrow(PathTraversalError);
  });

  it('should reject deeply nested traversal', () => {
    expect(() => resolveSafe(root, 'volumes/../../etc/passwd'))
      .toThrow(PathTraversalError);
  });

  it('should accept nested paths within root', () => {
    expect(resolveSafe(root, 'workspace/current.json'))
      .toBe(resolve(root, 'workspace/current.json'));
  });
});

describe('chapterPath', () => {
  const root = '/tmp/test-project';

  it('should generate correct chapter path', () => {
    expect(chapterPath(root, 1, 1))
      .toBe(resolve(root, 'volumes/v01/ch001.md'));
  });

  it('should pad volume and chapter numbers', () => {
    expect(chapterPath(root, 12, 345))
      .toBe(resolve(root, 'volumes/v12/ch345.md'));
  });
});

describe('novelYamlPath', () => {
  it('should return novel.yaml path', () => {
    expect(novelYamlPath('/tmp/project'))
      .toBe(resolve('/tmp/project', 'novel.yaml'));
  });
});

describe('workspaceJsonPath', () => {
  it('should return workspace/current.json path', () => {
    expect(workspaceJsonPath('/tmp/project'))
      .toBe(resolve('/tmp/project', 'workspace/current.json'));
  });
});

describe('parseVolumeNumber', () => {
  it('should parse valid volume dir names', () => {
    expect(parseVolumeNumber('v01')).toBe(1);
    expect(parseVolumeNumber('v12')).toBe(12);
    expect(parseVolumeNumber('v99')).toBe(99);
  });

  it('should return null for invalid names', () => {
    expect(parseVolumeNumber('vol01')).toBeNull();
    expect(parseVolumeNumber('chapter01')).toBeNull();
    expect(parseVolumeNumber('v1')).toBeNull();
  });
});

describe('parseChapterId', () => {
  it('should parse valid chapter file names', () => {
    expect(parseChapterId('ch001.md')).toBe(1);
    expect(parseChapterId('ch123.md')).toBe(123);
  });

  it('should return null for invalid names', () => {
    expect(parseChapterId('chapter001.md')).toBeNull();
    expect(parseChapterId('ch1.md')).toBeNull();
    expect(parseChapterId('ch001.txt')).toBeNull();
  });
});

describe('memory paths', () => {
  const root = '/tmp/test-project';

  it('memoryDir should return memory/ path', () => {
    expect(memoryDir(root)).toBe(resolve(root, 'memory'));
  });

  it('summariesDir should return memory/summaries/ path', () => {
    expect(summariesDir(root)).toBe(resolve(root, 'memory/summaries'));
  });

  it('summaryFilePath should pad chapter number', () => {
    expect(summaryFilePath(root, 1)).toBe(resolve(root, 'memory/summaries/ch001.json'));
    expect(summaryFilePath(root, 42)).toBe(resolve(root, 'memory/summaries/ch042.json'));
  });

  it('batchSummariesDir should return memory/batch-summaries/ path', () => {
    expect(batchSummariesDir(root)).toBe(resolve(root, 'memory/batch-summaries'));
  });

  it('batchSummaryFilePath should pad range numbers', () => {
    expect(batchSummaryFilePath(root, 21, 30))
      .toBe(resolve(root, 'memory/batch-summaries/batch-021-030.json'));
  });

  it('storyStateFilePath should return memory/story-state.json', () => {
    expect(storyStateFilePath(root)).toBe(resolve(root, 'memory/story-state.json'));
  });
});
