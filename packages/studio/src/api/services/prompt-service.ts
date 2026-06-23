import { loadPrompt, getDefaultPrompts } from '@storyweaver/core';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Prompt 管理服务(G05-S08)
 *
 * 查看 / 编辑 / 恢复各 Agent 的系统 Prompt。
 * 覆盖文件存 config/prompts/<name>.md(可 git 共享的定制);未覆盖时用内嵌默认。
 */
export class PromptService {
  constructor(private readonly projectRoot: string) {}

  private fileOf(name: string): string {
    return resolve(this.projectRoot, 'config', 'prompts', `${name}.md`);
  }

  private async exists(name: string): Promise<boolean> {
    try {
      await readFile(this.fileOf(name));
      return true;
    } catch {
      return false;
    }
  }

  /** 列出全部 prompt 及是否已被覆盖 */
  async list(): Promise<Array<{ name: string; overridden: boolean }>> {
    const names = Object.keys(getDefaultPrompts());
    const result: Array<{ name: string; overridden: boolean }> = [];
    for (const name of names) {
      result.push({ name, overridden: await this.exists(name) });
    }
    return result;
  }

  /** 读取单个 prompt(当前内容 + 默认 + 是否覆盖) */
  async get(name: string): Promise<{
    name: string;
    content: string;
    overridden: boolean;
    defaultContent: string;
  } | null> {
    const defaults = getDefaultPrompts();
    if (!defaults[name]) return null;
    return {
      name,
      content: loadPrompt(name, resolve(this.projectRoot, 'config')),
      overridden: await this.exists(name),
      defaultContent: defaults[name],
    };
  }

  /** 编辑 / 覆盖 prompt */
  async set(name: string, content: string): Promise<void> {
    if (!getDefaultPrompts()[name]) throw new Error(`未知 prompt: ${name}`);
    const dir = resolve(this.projectRoot, 'config', 'prompts');
    await mkdir(dir, { recursive: true });
    await writeFile(this.fileOf(name), content, 'utf-8');
  }

  /** 恢复默认(删除覆盖文件) */
  async reset(name: string): Promise<void> {
    try {
      await unlink(this.fileOf(name));
    } catch {
      // 未覆盖,无需删除
    }
  }
}
