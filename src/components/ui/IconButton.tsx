import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type IconButtonVariant = 'glass' | 'ghost' | 'solid' | 'danger'
export type IconButtonSize = 'sm' | 'md' | 'lg'

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** 必填：图标按钮没有可见文本，这条就是它的无障碍名字，同时兜底做 title */
  label: string
  variant?: IconButtonVariant
  size?: IconButtonSize
  /** 处于「已开启」状态（排序方向、多选模式、展开中的编辑区…），会渲染成 accent 并写 aria-pressed */
  active?: boolean
  children?: ReactNode
}

const BASE =
  'inline-flex shrink-0 items-center justify-center border ' +
  'transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-snap ' +
  'focus-ring active:scale-90 disabled:pointer-events-none disabled:opacity-45'

const SIZE: Readonly<Record<IconButtonSize, string>> = {
  sm: 'size-9 rounded-lg',
  // md 拉满 44px，是移动端可点区域的下限
  md: 'tap-target size-11 rounded-xl',
  lg: 'size-13 rounded-huge',
}

const VARIANT: Readonly<Record<IconButtonVariant, string>> = {
  glass: 'glass text-text hover:border-accent-line',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-surface-alt hover:text-text',
  solid: 'accent-glow border-transparent bg-accent text-on-accent hover:brightness-110',
  danger: 'border-transparent bg-transparent text-danger hover:bg-danger/12',
}

/** active 覆盖层：不换 variant，只把配色染成 accent，这样切换状态时不会跳形状 */
const ACTIVE = 'border-accent-line bg-accent-soft text-accent'

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  active,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      // 只有调用方真的把它当开关用时才写 aria-pressed，否则每个图标按钮都会被读成「切换按钮」
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        BASE,
        SIZE[size],
        VARIANT[variant],
        active && variant !== 'solid' && ACTIVE,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
