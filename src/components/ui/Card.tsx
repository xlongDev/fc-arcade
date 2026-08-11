import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type CardVariant = 'surface' | 'glass' | 'outline'

// 拿掉原生 title：这里的 title 是卡片标题槽位，不是 hover 气泡文案
export interface CardProps extends Omit<ComponentProps<'div'>, 'title'> {
  variant?: CardVariant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** hover 时抬起来一点，用在可点击的卡 */
  interactive?: boolean
  title?: ReactNode
  description?: ReactNode
  /** 标题行右侧的操作区 */
  actions?: ReactNode
}

const VARIANT: Readonly<Record<CardVariant, string>> = {
  surface: 'border border-border bg-surface',
  glass: 'glass',
  outline: 'border border-border bg-transparent',
}

const PADDING = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-7' } as const

/** 通用内容卡。设置页的分组、详情页的面板都走它。 */
export function Card({
  variant = 'surface',
  padding = 'md',
  interactive = false,
  title,
  description,
  actions,
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeader = title !== undefined || description !== undefined || actions !== undefined

  return (
    <div
      className={cn(
        'rounded-xl transition-[transform,box-shadow,border-color] duration-300 ease-pixel',
        VARIANT[variant],
        PADDING[padding],
        interactive && 'hover:-translate-y-1 hover:border-accent-line hover:shadow-lift',
        className,
      )}
      {...rest}
    >
      {hasHeader ? (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            {title !== undefined ? (
              <div className="text-sm font-medium text-text">{title}</div>
            ) : null}
            {description !== undefined ? (
              <div className="text-xs leading-relaxed text-muted">{description}</div>
            ) : null}
          </div>
          {actions !== undefined ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
