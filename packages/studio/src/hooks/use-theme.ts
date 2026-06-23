import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/**
 * 主题切换 hook(G06-S02 深色模式)
 *
 * 切换 <html> 的 .dark class,持久化到 localStorage,默认浅色。
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('theme') as Theme) ?? 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggle };
}
