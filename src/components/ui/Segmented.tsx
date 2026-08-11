import { useId } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'

import { cn } from '@/lib/cn'

import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface SegmentedOption<T extends string = string> {
  value: T
  label: string
  icon?: ReactNode
  disabled?: boolean
}

export interface SegmentedProps<T extends string> {
  value: T
  onChange: (next: T) => void
  /** 同 Select：用 string 收，避免调用方常量表没写 as const 就报错 */
  options: readonly SegmentedOption[]
  size?: 'sm' | 'md'
  /** 只显示图标，文字降级成 aria-label + title。窄屏工具栏用 */
  iconOnly?: boolean
  fullWidth?: boolean
  className?: string
  'aria-label'?: string
}

const SIZE = {
  sm: { track: 'h-9 rounded-lg p-1', item: 'gap-1.5 rounded-md px-2.5 text-xs', pill: 'rounded-md' },
  md: { track: 'h-11 rounded-xl p-1', item: 'gap-2 rounded-lg px-3 text-sm', pill: 'rounded-lg' },
} as const

/**
 * 分段选择器。
 *
 * 选中态用 layoutId 共享的那块滑块 —— 切换时它会从旧位置滑到新位置，
 * 而不是原地闪。滑块 id 用 useId 保证同页多个实例互不串。
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  iconOnly = false,
  fullWidth = false,
  className,
  'aria-label': ariaLabel,
}: SegmentedProps<T>) {
  const layoutId = useId()
  const style = SIZE[size]
  const reduce = usePrefersReducedMotion()

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex shrink-0 items-center border border-border bg-surface-alt/60',
        style.track,
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            disabled={option.disabled}
            onClick={() => onChange(option.value as T)}
            className={cn(
              'focus-ring relative flex h-full min-w-0 items-center justify-center',
              'transition-colors duration-200 ease-snap disabled:pointer-events-none disabled:opacity-40',
              style.item,
              fullWidth && 'flex-1',
              active ? 'text-on-accent' : 'text-muted hover:text-text',
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 520, damping: 38, mass: 0.6 }
                }
                className={cn('absolute inset-0 bg-accent', style.pill)}
              />
            ) : null}
            {option.icon ? (
              <span className="relative flex shrink-0 items-center">{option.icon}</span>
            ) : null}
            {iconOnly ? null : <span className="relative truncate">{option.label}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** 语义更完整的别名，页面侧按这个名字调用 */
export const SegmentedControl = Segmented
