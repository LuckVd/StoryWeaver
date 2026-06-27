import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 朱砂波浪线包裹 —— 把审稿引用的原文/关键词标成「朱批」。
 * 形态由 globals.css 的 `.vermilion-underline` / `--strong` 控制。
 */
type VermilionMarkProps = {
  children: ReactNode;
  /** 浏览器原生波浪线偏平时,用更锐利的渐变版 */
  strong?: boolean;
  className?: string;
};

export function VermilionMark({ children, strong = false, className }: VermilionMarkProps) {
  return (
    <span className={cn('vermilion-underline', strong && 'vermilion-underline--strong', className)}>
      {children}
    </span>
  );
}
