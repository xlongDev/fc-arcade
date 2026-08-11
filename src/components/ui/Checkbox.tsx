import type { ComponentProps } from 'react'

import { IconCheck } from '@/components/icons'
import { cn } from '@/lib/cn'

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'onChange' | 'type' | 'size'> {
  checked: boolean
  /** 直接给下一个状态，调用方不用再从 event.target 里掏 */
  onChange?: (checked: boolean) => void
  size?: 'sm' | 'md'
  /** 半选（「全选」在部分选中时用） */
  indeterminate?: boolean
  /**
   * 传了就自带一行文字并包一层 <label>。
   * 外层已经有自己的 <label>（比如 CandidateList 的「全选可导入项」）时别传，
   * 嵌套 label 是无效 HTML。
   */
  label?: string
}

const SIZE = { sm: 'size-4', md: 'size-5' } as const
const MARK = { sm: 11, md: 13 } as const

/**
 * 勾选框。
 *
 * 结构上是「透明的原生 input 盖在视觉方块上」而不是 sr-only + 自绘按钮，
 * 为的是两种用法都成立：
 *   1. 单独摆放时，点方块 = 点到 input；
 *   2. 被外层 <label> 包住时（CandidateList 的「全选可导入项」），
 *      隐式关联仍然生效，点文字也能切换。
 */
export function Checkbox({
  checked,
  onChange,
  size = 'md',
  indeterminate = false,
  label,
  disabled,
  className,
  ...rest
}: CheckboxProps) {
  const box = (
    <span className={cn('relative inline-flex shrink-0', SIZE[size], label === undefined && className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        // 只在半选时覆盖 aria-checked；其余情况让原生 checked 自己说话，
        // 手写一份反而容易和真实状态漂移
        aria-checked={indeterminate ? 'mixed' : undefined}
        // indeterminate 是 DOM 属性不是 HTML 特性，只能通过节点设置
        ref={(node) => {
          if (node) node.indeterminate = indeterminate
        }}
        onChange={(event) => onChange?.(event.target.checked)}
        className={cn(
          'peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0',
          disabled && 'cursor-not-allowed',
        )}
        {...rest}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none flex size-full items-center justify-center rounded-sm border-2',
          'transition-[background-color,border-color,box-shadow] duration-150 ease-snap',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          checked || indeterminate
            ? 'border-accent bg-accent text-on-accent'
            : 'border-border bg-surface-alt text-transparent peer-hover:border-accent-line',
          disabled && 'opacity-45',
        )}
      >
        {indeterminate ? (
          <span className="h-0.5 w-2.5 bg-current" />
        ) : (
          <IconCheck size={MARK[size]} strokeWidth={3} />
        )}
      </span>
    </span>
  )

  if (label === undefined) return box

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 text-sm text-text',
        disabled === true && 'cursor-not-allowed opacity-45',
        className,
      )}
    >
      {box}
      <span className="min-w-0">{label}</span>
    </label>
  )
}
