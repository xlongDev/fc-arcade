import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg'

export interface SpinnerProps extends Omit<ComponentProps<'span'>, 'children'> {
  size?: SpinnerSize
  /** 屏幕阅读器读到的文本，传 null 表示纯装饰（外层已有说明） */
  label?: string | null
}

const SIZE: Readonly<Record<SpinnerSize, string>> = {
  xs: 'size-3.5 border-2',
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-10 border-4',
}

/**
 * 步进旋转的像素 loading 环。
 * 用 animate-spin-step（steps(8)）而不是平滑 spin —— 8 帧一圈才是 8bit 该有的手感。
 */
export function Spinner({ size = 'md', label = '加载中', className, ...rest }: SpinnerProps) {
  return (
    <span
      role={label === null ? undefined : 'status'}
      aria-label={label ?? undefined}
      aria-hidden={label === null ? true : undefined}
      className={cn(
        'inline-block shrink-0 animate-spin-step rounded-full border-accent-line border-t-accent',
        SIZE[size],
        className,
      )}
      {...rest}
    />
  )
}
