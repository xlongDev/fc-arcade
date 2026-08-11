import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  /** 主行动按钮，一般是 <Button> */
  action?: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

/** 空态占位。图标托在一块 accent-soft 的圆角砖上，避免大片留白显得像出错了。 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'sm' ? 'gap-3 px-4 py-8' : 'gap-4 px-6 py-14',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex items-center justify-center rounded-huge border border-accent-line bg-accent-soft text-accent',
            size === 'sm' ? 'size-14' : 'size-20',
          )}
        >
          {icon}
        </span>
      ) : null}

      <div className="flex max-w-md flex-col gap-1.5">
        <p className={cn('font-medium text-text', size === 'sm' ? 'text-sm' : 'text-base')}>
          {title}
        </p>
        {description ? (
          <p className="text-xs leading-relaxed text-muted sm:text-sm">{description}</p>
        ) : null}
      </div>

      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}
