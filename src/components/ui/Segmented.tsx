import { useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { m } from 'motion/react'

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
 *
 * 键盘行为按 WAI-ARIA radiogroup 模式：左右/上下方向键在选项间移动并直接
 * 切换（单选组的选中随焦点走），Home/End 跳到首/末项；用 roving tabindex
 * 让整组只占用一个 Tab 停靠点，禁用项会被方向键跳过。
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
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const usable = options.filter((option) => option.disabled !== true)
  const currentIndex = usable.findIndex((option) => option.value === value)

  const focusAndSelect = (option: SegmentedOption) => {
    onChange(option.value as T)
    const idx = options.indexOf(option)
    itemRefs.current[idx]?.focus()
  }

  const move = (delta: number) => {
    if (usable.length === 0) return
    const from = currentIndex < 0 ? 0 : currentIndex
    const next = usable[(from + delta + usable.length) % usable.length]
    if (next) focusAndSelect(next)
  }

  const jump = (toEnd: boolean) => {
    if (usable.length === 0) return
    const target = toEnd ? usable[usable.length - 1] : usable[0]
    if (target) focusAndSelect(target)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        jump(false)
        break
      case 'End':
        event.preventDefault()
        jump(true)
        break
      default:
        break
    }
  }

  // roving tabindex：选中的项停靠 tabIndex=0；若 value 没落在任何可用项上
  // （受控值异常），退化成首个可用项停靠，保证整组始终有一个 Tab 出入口
  const tabbableValue = currentIndex >= 0 ? value : usable[0]?.value

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex shrink-0 items-center border border-border bg-surface-alt/60',
        style.track,
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value
        const tabbable = option.value === tabbableValue
        return (
          <button
            key={option.value}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            tabIndex={tabbable ? 0 : -1}
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
              <m.span
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
