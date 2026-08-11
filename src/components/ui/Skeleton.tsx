import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export interface SkeletonProps extends ComponentProps<'div'> {
  /** 圆角跟随主题；传 'none' 交给外部 className 自己定 */
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'huge' | 'full' | 'none'
}

const RADIUS: Readonly<Record<NonNullable<SkeletonProps['radius']>, string>> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  huge: 'rounded-huge',
  full: 'rounded-full',
  none: '',
}

/** 骨架屏占位块。底色 + shimmer 扫光，尺寸完全交给调用方的 className。 */
export function Skeleton({ radius = 'lg', className, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('shimmer bg-surface-alt', RADIUS[radius], className)}
      {...rest}
    />
  )
}
