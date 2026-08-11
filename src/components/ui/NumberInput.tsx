import { useEffect, useState } from 'react'

import { IconMinus, IconPlus } from '@/components/icons'
import { cn } from '@/lib/cn'

export interface NumberInputProps {
  value: number
  onChange?: (next: number) => void
  min?: number
  max?: number
  step?: number
  /** 右侧单位，比如「秒」「%」 */
  unit?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  placeholder?: string
  'aria-label'?: string
}

const SIZE = {
  sm: { box: 'h-9 rounded-lg', btn: 'size-7 rounded-sm', text: 'text-xs' },
  md: { box: 'h-11 rounded-xl', btn: 'size-8 rounded-md', text: 'text-sm' },
} as const

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * 数字输入 + 步进按钮。
 *
 * 内部维持一份字符串草稿：输入过程中允许出现 ''、'-'、'19' 这类还没写完的中间态，
 * 不然每敲一个字符就 clamp 一次，用户根本改不动年份（1985 会在输 '1' 时被拉到 min）。
 * 真正上抛的时机是 blur / 回车 / 点步进按钮。
 */
export function NumberInput({
  value,
  onChange,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  unit,
  disabled = false,
  size = 'md',
  className,
  placeholder,
  'aria-label': ariaLabel,
}: NumberInputProps) {
  const [draft, setDraft] = useState(String(value))
  const style = SIZE[size]

  // 外部改值（重置、别处联动）时把草稿拉回来；正在编辑的中间态不受影响，
  // 因为那时 draft 解析出来就等于 value
  useEffect(() => {
    setDraft((prev) => (Number(prev) === value ? prev : String(value)))
  }, [value])

  const commit = (raw: string) => {
    const parsed = Number(raw)
    const next = raw.trim() === '' || Number.isNaN(parsed) ? clamp(0, min, max) : clamp(parsed, min, max)
    setDraft(String(next))
    if (next !== value) onChange?.(next)
  }

  const nudge = (delta: number) => {
    const base = Number.isNaN(Number(draft)) ? value : Number(draft)
    const next = clamp(base + delta, min, max)
    setDraft(String(next))
    if (next !== value) onChange?.(next)
  }

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center gap-1 border border-border bg-surface-alt/60 px-1',
        'transition-[border-color,box-shadow] duration-200 ease-snap',
        'focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
        disabled && 'pointer-events-none opacity-45',
        style.box,
        className,
      )}
    >
      <button
        type="button"
        aria-label="减少"
        disabled={disabled || value <= min}
        onClick={() => nudge(-step)}
        className={cn(
          'focus-ring flex shrink-0 items-center justify-center text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-35',
          style.btn,
        )}
      >
        <IconMinus size={13} />
      </button>

      <input
        type="text"
        inputMode="numeric"
        role="spinbutton"
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemin={min === Number.MIN_SAFE_INTEGER ? undefined : min}
        aria-valuemax={max === Number.MAX_SAFE_INTEGER ? undefined : max}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value)
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            nudge(step)
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            nudge(-step)
          }
        }}
        className={cn(
          'min-w-0 flex-1 border-0 bg-transparent p-0 text-center font-pixel text-text tabular-nums outline-none placeholder:text-faint',
          style.text,
        )}
      />

      {unit ? <span className="shrink-0 pr-1 text-xs text-faint">{unit}</span> : null}

      <button
        type="button"
        aria-label="增加"
        disabled={disabled || value >= max}
        onClick={() => nudge(step)}
        className={cn(
          'focus-ring flex shrink-0 items-center justify-center text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-35',
          style.btn,
        )}
      >
        <IconPlus size={13} />
      </button>
    </div>
  )
}
