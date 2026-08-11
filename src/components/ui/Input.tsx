import type { ComponentProps, ReactNode } from 'react'

import { IconClose } from '@/components/icons'
import { cn } from '@/lib/cn'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps
  extends Omit<ComponentProps<'input'>, 'onChange' | 'value' | 'size' | 'prefix'> {
  value: string
  /** 直接给新字符串。调用方几乎从不需要原始 event，省掉 e.target.value 这行样板 */
  onChange?: (next: string) => void
  size?: InputSize
  /** 左侧装饰，通常是搜索/链接图标 */
  icon?: ReactNode
  /** 右侧装饰，会排在清除按钮左边 */
  suffix?: ReactNode
  /** 有内容时右侧浮出清除按钮 */
  clearable?: boolean
  invalid?: boolean
}

const SIZE: Readonly<Record<InputSize, string>> = {
  sm: 'h-9 rounded-lg text-xs',
  md: 'h-11 rounded-xl text-sm',
  lg: 'h-13 rounded-huge text-base',
}

const PAD_X: Readonly<Record<InputSize, string>> = {
  sm: 'px-2.5',
  md: 'px-3.5',
  lg: 'px-5',
}

export function Input({
  value,
  onChange,
  size = 'md',
  icon,
  suffix,
  clearable = false,
  invalid = false,
  disabled,
  className,
  ...rest
}: InputProps) {
  const showClear = clearable && value.length > 0 && disabled !== true

  return (
    <div
      className={cn(
        'group flex w-full min-w-0 items-center gap-2 border bg-surface-alt/60',
        'transition-[background-color,border-color,box-shadow] duration-200 ease-snap',
        // 焦点环画在容器上，因为真正的 <input> 是无边框透明的
        'focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
        invalid ? 'border-danger' : 'border-border hover:border-accent-line',
        disabled === true && 'pointer-events-none opacity-45',
        SIZE[size],
        PAD_X[size],
        className,
      )}
    >
      {icon ? <span className="flex shrink-0 items-center text-faint">{icon}</span> : null}

      <input
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange?.(event.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-text outline-none placeholder:text-faint"
        {...rest}
      />

      {suffix ? <span className="flex shrink-0 items-center text-faint">{suffix}</span> : null}

      {showClear ? (
        <button
          type="button"
          aria-label="清空"
          // 鼠标按下就清空会先让 input 失焦，改成在 mousedown 阶段拦下来，保持焦点在输入框里
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange?.('')}
          className="focus-ring flex shrink-0 items-center rounded-sm text-faint transition-colors hover:text-text"
        >
          <IconClose size={14} />
        </button>
      ) : null}
    </div>
  )
}
