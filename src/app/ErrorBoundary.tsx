import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** 出错时的自定义渲染，不给就用内置面板 */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * 全局错误边界。
 * 刻意不依赖 @/components/ui——UI 组件库自身出错时兜底页面还得能渲染。
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[fc-arcade] 渲染出错', error, info.componentStack)
  }

  private readonly reset = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-surface)] p-8 shadow-2xl">
          <p className="font-pixel text-lg text-[var(--color-danger)]">页面崩溃了</p>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            渲染过程中出现未捕获的异常。可以先重试，如果反复出现请回到游戏库。
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-2xl bg-[var(--color-bg)] p-4 text-xs whitespace-pre-wrap text-[var(--color-text-faint)]">
            {error.message}
          </pre>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-2xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-on-accent)] transition-transform active:scale-95"
            >
              重试
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/'
                window.location.reload()
              }}
              className="rounded-2xl border border-[var(--color-border)] px-5 py-2.5 text-sm text-[var(--color-text)] transition-transform active:scale-95"
            >
              回到游戏库
            </button>
          </div>
        </div>
      </div>
    )
  }
}
