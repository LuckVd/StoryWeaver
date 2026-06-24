import { marked } from 'marked';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

const HAS_HTML_TAG = /<[a-z][\s\S]*?>/i;

/** 内容是否含 HTML 标签（用于区分旧 HTML 数据与新 Markdown 存储） */
export function isHtml(content: string): boolean {
  return HAS_HTML_TAG.test(content);
}

/** HTML → Markdown（编辑器内容落盘时用） */
export function htmlToMd(html: string): string {
  if (!html) return '';
  return turndown.turndown(html).trim();
}

/** Markdown → HTML（从磁盘读入编辑器时用）；已是 HTML（旧数据）则原样返回，无需转换 */
export function mdToHtml(content: string): string {
  if (!content) return '';
  if (isHtml(content)) return content;
  return marked.parse(content, { async: false }) as string;
}

/** 任意内容（HTML 或 Markdown）→ 纯文本，供 LLM / stats / 搜索（去所有标记） */
export function toPlainText(content: string): string {
  if (!content) return '';
  const html = isHtml(content) ? content : (marked.parse(content, { async: false }) as string);
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
