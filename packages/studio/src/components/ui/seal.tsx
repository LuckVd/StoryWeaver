import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 印章标记 —— 朱批墨韵的 signature 元素之一。
 * 用于:审稿严重度(◆/◦)、AI 头像、朱批字(朱/墨)、active 强调。
 * 颜色与形态由 globals.css 的 `.seal` / `.seal--round` / `.seal--filled` 控制,
 * 这里只做语义化封装 + 尺寸覆盖。
 */
type SealProps = {
  children: ReactNode;
  variant?: 'outline' | 'filled';
  shape?: 'square' | 'round';
  className?: string;
};

export function Seal({ children, variant = 'outline', shape = 'square', className }: SealProps) {
  return (
    <span
      className={cn(
        'seal',
        shape === 'round' && 'seal--round',
        variant === 'filled' && 'seal--filled',
        className,
      )}
    >
      {children}
    </span>
  );
}
