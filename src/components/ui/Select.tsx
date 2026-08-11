import type { ReactNode } from 'react'

import { IconChevronDown } from '@/components/icons'
import { cn } from '@/lib/cn'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SelectProps<T extends string> {
  value: T
  onChange: (next: T) => void
  /**
   * 这里刻意用 SelectOption<string> 而不是 SelectOption<T>：
   * 调用方的常量表大多写成 `const OPTIONS = [{ value: 'a', ... }]`，
   * 没有 as const，value 会被推宽成 string，用 T 约束的话每个调用点都得补断言。
   * T 由 value / onChange 推出来，联动仍然是准的。
   */
  options: readonly SelectOption[]
  size?: 'sm' | 'md'
  /** 左侧装饰图标 */
  icon?: ReactNode
  disabled?: boolean
  fullWidth?: boolean
  className?: string
  'aria-label'?: string
}

const SIZE = {
  sm: 'h-9 rounded-lg pl-2.5 text-xs',
  md: 'h-11 rounded-xl pl-3.5 text-sm',
} as const

/**
 * 下拉选择。
 *
 * 内核就是原生 <select>，只是把它铺成透明层盖在自绘外观上。
 * 自绘列表在移动端不如系统 picker 好用，而且要自己处理键盘、滚动、
 * 屏幕阅读器——不值得。外观由下面那层负责，行为交给浏览器。
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  icon,
  disabled = false,
  fullWidth = true,
  className,
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  const current = options.find((option) => option.value === value)

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 border border-border bg-surface-alt/60 pr-2',
        'transition-[border-color,box-shadow] duration-200 ease-snap hover:border-accent-line',
        'focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
        disabled && 'pointer-events-none opacity-45',
        SIZE[size],
        fullWidth ? 'w-full' : 'inline-flex',
        className,
      )}
    >
      {icon ? <span className="flex shrink-0 items-center text-faint">{icon}</span> : null}

      <span className="min-w-0 flex-1 truncate text-text">{current?.label ?? value}</span>
      <IconChevronDown size={15} className="shrink-0 text-faint" />

      <select
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value as T)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
