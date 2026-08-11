import { useId } from 'react'

import { cn } from '@/lib/cn'

export interface SwitchProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  /** 有 label 时整体渲染成一行「文字 + 开关」，点整行都能切换 */
  label?: string
  description?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const TRACK = { sm: 'h-5 w-9', md: 'h-6 w-11' } as const
const THUMB = { sm: 'size-3.5', md: 'size-4.5' } as const
const SHIFT = { sm: 'translate-x-4', md: 'translate-x-5' } as const

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className,
}: SwitchProps) {
  const id = useId()

  const control = (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label === undefined ? undefined : label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border p-0.5',
        'transition-[background-color,border-color,box-shadow] duration-200 ease-snap',
        'focus-ring disabled:pointer-events-none disabled:opacity-45',
        TRACK[size],
        checked ? 'border-transparent bg-accent' : 'border-border bg-surface-alt',
      )}
    >
      <span
        className={cn(
          'block rounded-full transition-transform duration-200 ease-back',
          THUMB[size],
          checked ? cn('bg-on-accent', SHIFT[size]) : 'bg-faint translate-x-0',
        )}
      />
    </button>
  )

  if (label === undefined) return <span className={className}>{control}</span>

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4',
        disabled && 'cursor-not-allowed opacity-45',
        className,
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-sm text-text">{label}</span>
        {description ? <span className="text-xs text-faint">{description}</span> : null}
      </span>
      {control}
    </label>
  )
}
