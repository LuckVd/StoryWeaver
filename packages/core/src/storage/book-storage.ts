import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import type { Book } from '../models/index.js';
import { novelYamlPath } from './path.js';

/**
 * Book 存储层 — novel.yaml 读写
 */
export class BookStorage {
  private readonly filePath: string;

  constructor(projectRoot: string) {
    this.filePath = novelYamlPath(projectRoot);
  }

  /** 读取 novel.yaml，不存在返回 null */
  async read(): Promise<Book | null> {
    if (!existsSync(this.filePath)) {
      return null;
    }
    const raw = await readFile(this.filePath, 'utf-8');
    return parse(raw) as Book;
  }

  /** 写入 novel.yaml */
  async write(book: Book): Promise<void> {
    const content = stringify(book);
    await writeFile(this.filePath, content, 'utf-8');
  }

  /** 检查 novel.yaml 是否存在 */
  exists(): boolean {
    return existsSync(this.filePath);
  }
}
