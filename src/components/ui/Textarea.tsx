import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

export interface TextareaProps
  extends Omit<ComponentProps<'textarea'>, 'onChange' | 'value' | 'rows'> {
  value: string
  /** 跟 Input 保持一致：给值不给事件 */
  onChange?: (next: string) => void
  rows?: number
  invalid?: boolean
  /** 右下角字数统计，需要配合 maxLength */
  showCount?: boolean
}

/** 多行文本。视觉与 Input 同源，只是高度可变。 */
export function Textarea({
  value,
  onChange,
  rows = 4,
  invalid = false,
  showCount = false,
  maxLength,
  disabled,
  className,
  ...rest
}: TextareaProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-1 rounded-xl border bg-surface-alt/60 px-3.5 py-2.5',
        'transition-[border-color,box-shadow] duration-200 ease-snap',
        'focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
        invalid ? 'border-danger' : 'border-border hover:border-accent-line',
        disabled === true && 'pointer-events-none opacity-45',
        className,
      )}
    >
      <textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-full resize-y border-0 bg-transparent p-0 text-sm leading-relaxed text-text outline-none placeholder:text-faint"
        {...rest}
      />
      {showCount && maxLength !== undefined ? (
        <span className="self-end font-pixel text-[10px] text-faint tabular-nums">
          {value.length}/{maxLength}
        </span>
      ) : null}
    </div>
  )
}
