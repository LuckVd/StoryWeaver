import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspaceStorage } from '../workspace-storage.js';
import type { Workspace } from '../../models/index.js';

describe('WorkspaceStorage', () => {
  let projectRoot: string;
  let storage: WorkspaceStorage;

  const sampleWorkspace: Workspace = {
    chapterIds: [1, 2, 3],
    createdAt: '2026-05-24T10:00:00Z',
    updatedAt: '2026-05-24T10:00:00Z',
  };

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-ws-test-'));
    storage = new WorkspaceStorage(projectRoot);
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('should return null when workspace does not exist', async () => {
    expect(await storage.read()).toBeNull();
  });

  it('should write and read back workspace', async () => {
    await storage.write(sampleWorkspace);
    const ws = await storage.read();

    expect(ws).not.toBeNull();
    expect(ws!.chapterIds).toEqual([1, 2, 3]);
  });

  it('should overwrite existing workspace', async () => {
    const updated: Workspace = { ...sampleWorkspace, chapterIds: [4, 5] };
    await storage.write(updated);
    const ws = await storage.read();

    expect(ws!.chapterIds).toEqual([4, 5]);
  });
});
