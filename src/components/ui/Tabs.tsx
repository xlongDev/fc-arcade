import { useId } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'

import { cn } from '@/lib/cn'

import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface TabItem<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  badge?: ReactNode
  disabled?: boolean
}

export interface TabsProps<T extends string> {
  value: T
  onChange: (next: T) => void
  items: readonly TabItem<T>[]
  /** underline 走横向下划线，pill 走胶囊底块 */
  variant?: 'underline' | 'pill'
  className?: string
  'aria-label'?: string
}

/**
 * 标签页导航（只管标签条，内容区由调用方自己按 value 渲染）。
 *
 * 键盘行为按 WAI-ARIA tabs 模式：左右方向键在标签间移动并直接切换，
 * 所以标签条本身用 roving tabindex——只有当前项能被 Tab 命中。
 */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  variant = 'underline',
  className,
  'aria-label': ariaLabel,
}: TabsProps<T>) {
  const layoutId = useId()
  const reduce = usePrefersReducedMotion()

  const move = (delta: number) => {
    const usable = items.filter((item) => item.disabled !== true)
    const index = usable.findIndex((item) => item.value === value)
    if (index < 0) return
    const next = usable[(index + delta + usable.length) % usable.length]
    if (next) onChange(next.value)
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          move(1)
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault()
          move(-1)
        }
      }}
      className={cn(
        'flex items-center gap-1 overflow-x-auto',
        variant === 'underline' && 'border-b border-border',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'focus-ring relative flex shrink-0 items-center gap-2 px-3 py-2 text-sm whitespace-nowrap',
              'transition-colors duration-200 ease-snap disabled:pointer-events-none disabled:opacity-40',
              variant === 'pill' && 'rounded-lg',
              active ? 'text-text' : 'text-muted hover:text-text',
            )}
          >
            {/* 指示块必须排在文字前面：它和文字都是同一层级的定位元素，
                谁写在后面谁盖住谁，放后面会把标签文字糊掉 */}
            {active ? (
              <motion.span
                layoutId={layoutId}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 520, damping: 38, mass: 0.6 }
                }
                className={
                  variant === 'underline'
                    ? 'absolute inset-x-2 -bottom-px h-0.5 bg-accent'
                    : 'absolute inset-0 rounded-lg bg-accent-soft'
                }
              />
            ) : null}

            {item.icon ? <span className="relative flex items-center">{item.icon}</span> : null}
            <span className="relative">{item.label}</span>
            {item.badge === undefined ? null : <span className="relative">{item.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
