import { describe, it, expect } from 'vitest';
import { htmlToMd, mdToHtml, toPlainText, isHtml } from '../md-utils';

describe('md-utils（C2 HTML↔Markdown 转换）', () => {
  it('htmlToMd：HTML 段落转 Markdown 空行分隔', () => {
    expect(htmlToMd('<p>第一段</p><p>第二段</p>')).toBe('第一段\n\n第二段');
  });

  it('mdToHtml：Markdown 转 HTML；已是 HTML（旧数据）原样返回', () => {
    expect(mdToHtml('段落')).toContain('段落');
    expect(mdToHtml('<p>已是HTML</p>')).toBe('<p>已是HTML</p>');
  });

  it('toPlainText：去 HTML 标签', () => {
    expect(toPlainText('<p>张三<b>出发</b></p>')).toBe('张三出发');
  });

  it('toPlainText：去 Markdown 标记', () => {
    expect(toPlainText('# 标题')).toBe('标题');
    expect(toPlainText('**加粗**')).toBe('加粗');
  });

  it('isHtml：区分 HTML 与纯 Markdown', () => {
    expect(isHtml('<p>x</p>')).toBe(true);
    expect(isHtml('纯文本')).toBe(false);
  });
});
