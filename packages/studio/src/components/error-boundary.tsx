import { Component, type ReactNode } from 'react';

interface State {
  hasError: boolean;
  message: string;
}

/**
 * 全局错误边界(G06-S07)
 *
 * 捕获子树渲染异常,显示错误卡片 + 刷新入口,避免整个应用白屏。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-destructive/50 bg-destructive/5 p-5">
            <h2 className="mb-2 font-semibold text-destructive">页面出错</h2>
            <p className="mb-4 text-sm text-muted-foreground">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
