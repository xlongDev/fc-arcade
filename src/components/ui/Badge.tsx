import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export type BadgeVariant =
  | 'default'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline'

export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends ComponentProps<'span'> {
  /**
   * 未知取值会回落到 default。
   * 之所以不锁死成联合类型：调用方 features/common/lib/gameDisplay.ts 里的
   * CONFIDENCE_BADGE 被标注成了 Record<MatchConfidence, string>，锁死会直接报错。
   */
  variant?: BadgeVariant | (string & {})
  size?: BadgeSize
  /** 左侧小圆点，用来在纯文字标签上补一层颜色暗示 */
  dot?: boolean
}

const SIZE: Readonly<Record<BadgeSize, string>> = {
  sm: 'h-5 gap-1 rounded-md px-1.5 text-[10px]',
  md: 'h-6 gap-1.5 rounded-lg px-2 text-xs',
}

const VARIANT: Readonly<Record<BadgeVariant, string>> = {
  default: 'border-border bg-surface-alt text-muted',
  accent: 'border-accent-line bg-accent-soft text-accent',
  success: 'border-success/35 bg-success/12 text-success',
  warning: 'border-warning/35 bg-warning/12 text-warning',
  danger: 'border-danger/35 bg-danger/12 text-danger',
  info: 'border-glass-border bg-glass text-text',
  outline: 'border-border bg-transparent text-muted',
}

function resolve(variant: string): string {
  return VARIANT[variant as BadgeVariant] ?? VARIANT.default
}

/** 小标签。放在卡片、行内标题旁边，字号刻意压到 10~12px。 */
export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center border leading-none font-medium',
        SIZE[size],
        resolve(variant),
        className,
      )}
      {...rest}
    >
      {dot ? <span className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      <span className="truncate">{children}</span>
    </span>
  )
}
