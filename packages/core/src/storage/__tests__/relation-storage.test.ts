import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RelationStorage } from '../relation-storage.js';

describe('RelationStorage', () => {
  let projectRoot: string;
  let storage: RelationStorage;

  beforeAll(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sw-relation-test-'));
    storage = new RelationStorage(projectRoot);
  });

  afterAll(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('should list empty when no relations', async () => {
    expect(await storage.list()).toEqual([]);
  });

  it('should create a relation edge', async () => {
    const edge = await storage.create({
      from: 'char-1',
      to: 'char-2',
      type: '师徒',
      direction: 'directed',
      since: '第1章',
      note: '主角的师父',
    });
    expect(edge.id).toBeDefined();
    expect(edge.type).toBe('师徒');
    expect(edge.direction).toBe('directed');
  });

  it('should get relation by id', async () => {
    const list = await storage.list();
    const edge = await storage.get(list[0].id);
    expect(edge).not.toBeNull();
    expect(edge!.type).toBe('师徒');
  });

  it('should update relation', async () => {
    const list = await storage.list();
    const updated = await storage.update(list[0].id, { note: '改了备注' });
    expect(updated!.note).toBe('改了备注');
  });

  it('should delete relation', async () => {
    const list = await storage.list();
    expect(await storage.delete(list[0].id)).toBe(true);
    expect(await storage.list()).toHaveLength(0);
  });

  it('should return null for non-existent get', async () => {
    expect(await storage.get('non-existent')).toBeNull();
  });

  it('should return false for non-existent delete', async () => {
    expect(await storage.delete('non-existent')).toBe(false);
  });

  it('should return null for non-existent update', async () => {
    expect(await storage.update('non-existent', { note: 'x' })).toBeNull();
  });
});
