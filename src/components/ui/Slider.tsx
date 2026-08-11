import { useId } from 'react'

import { cn } from '@/lib/cn'

export interface SliderProps {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  /** 右上角显示的读数格式化，不传就显示原始数字 */
  formatValue?: (value: number) => string
  disabled?: boolean
  className?: string
}

/**
 * 单值滑块。
 *
 * 用原生 range + accent-color 而不是自绘 thumb：拖拽手感、键盘方向键、
 * 触摸端的命中区都是浏览器给的，自己实现只会更差。
 * 已填充部分靠一层线性渐变背景做出来，颜色走 CSS 变量所以跟主题联动。
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  formatValue,
  disabled = false,
  className,
}: SliderProps) {
  const id = useId()
  const span = max - min
  const percent = span > 0 ? ((value - min) / span) * 100 : 0

  return (
    <div className={cn('flex w-full flex-col gap-2', disabled && 'opacity-45', className)}>
      {label === undefined ? null : (
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className="text-xs text-muted">
            {label}
          </label>
          <span className="font-pixel text-[10px] text-faint tabular-nums">
            {formatValue ? formatValue(value) : value}
          </span>
        </div>
      )}

      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          background: `linear-gradient(to right, var(--color-accent) ${percent}%, var(--color-surface-alt) ${percent}%)`,
        }}
        className={cn(
          'focus-ring h-2 w-full cursor-pointer appearance-none rounded-full border border-border',
          '[accent-color:var(--color-accent)]',
          // WebKit / Firefox 的 thumb 得分别写，没有统一选择器
          '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:border-2',
          '[&::-webkit-slider-thumb]:border-[var(--color-accent)] [&::-webkit-slider-thumb]:bg-[var(--color-text)]',
          '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-sm [&::-moz-range-thumb]:border-2',
          '[&::-moz-range-thumb]:border-[var(--color-accent)] [&::-moz-range-thumb]:bg-[var(--color-text)]',
          disabled && 'cursor-not-allowed',
        )}
      />
    </div>
  )
}
