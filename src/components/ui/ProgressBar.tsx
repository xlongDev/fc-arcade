import { cn } from '@/lib/cn'

export type ProgressVariant = 'accent' | 'success' | 'warning' | 'danger'

export interface ProgressBarProps {
  /** 进度值，默认按满分 100 解释（即直接传百分比）。indeterminate 为真时忽略 */
  value?: number
  /** 满分。传 max 就能直接喂 3/7 这种原始计数，不用自己先算百分比 */
  max?: number
  /** 总量未知时的扫光条 */
  indeterminate?: boolean
  variant?: ProgressVariant
  size?: 'sm' | 'md'
  /** 条右侧跟一个百分比数字 */
  showValue?: boolean
  label?: string
  className?: string
}

const HEIGHT = { sm: 'h-1.5', md: 'h-2.5' } as const

const FILL: Readonly<Record<ProgressVariant, string>> = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

export function ProgressBar({
  value = 0,
  max = 100,
  indeterminate = false,
  variant = 'accent',
  size = 'md',
  showValue = false,
  label,
  className,
}: ProgressBarProps) {
  const ratio = max > 0 && Number.isFinite(value) ? (value / max) * 100 : 0
  const clamped = Math.min(100, Math.max(0, ratio))

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        // 未知进度时不写 valuenow，屏幕阅读器才会念「忙碌」而不是「0%」
        aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
        className={cn(
          'relative min-w-0 flex-1 overflow-hidden rounded-full border border-border bg-surface-alt',
          HEIGHT[size],
        )}
      >
        {indeterminate ? (
          // 总量未知：铺满一条淡 accent，靠 shimmer 扫光表示「在动」。
          // 复用已有的 --animate-shimmer，不另外注册 keyframes
          <span className={cn('shimmer absolute inset-0 opacity-30', FILL[variant])} />
        ) : (
          <span
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-pixel',
              FILL[variant],
            )}
            style={{ width: `${clamped}%` }}
          />
        )}
      </div>

      {showValue ? (
        <span className="w-10 shrink-0 text-right font-pixel text-[10px] text-muted tabular-nums">
          {indeterminate ? '--' : `${Math.round(clamped)}%`}
        </span>
      ) : null}
    </div>
  )
}
