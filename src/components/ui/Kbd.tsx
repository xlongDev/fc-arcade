import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export interface KbdProps extends ComponentProps<'kbd'> {
  size?: 'sm' | 'md'
}

const SIZE = {
  sm: 'h-5 min-w-5 px-1 text-[10px]',
  md: 'h-6.5 min-w-6.5 px-1.5 text-xs',
} as const

/** 键帽。用 pixel-shadow 做出实体键的硬边投影，跟按键映射设置页的调性一致。 */
export function Kbd({ size = 'md', className, children, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        'pixel-shadow inline-flex items-center justify-center rounded-sm border border-border',
        'bg-surface-alt font-pixel leading-none text-muted uppercase',
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  )
}
