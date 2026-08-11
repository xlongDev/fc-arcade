import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/cn'

import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** 前置图标，通常是 @/components/icons 里的组件 */
  icon?: ReactNode
  /** 后置图标，比如下拉箭头 */
  iconRight?: ReactNode
  /** 转圈并锁交互。会替换掉 icon 的位置，宽度不跳 */
  loading?: boolean
  fullWidth?: boolean
}

const BASE =
  'relative inline-flex shrink-0 items-center justify-center gap-2 border font-medium whitespace-nowrap ' +
  'select-none transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-snap ' +
  'focus-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45'

const SIZE: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-9 rounded-lg px-3 text-xs',
  md: 'h-11 rounded-xl px-4 text-sm',
  lg: 'h-13 rounded-huge px-6 text-base',
}

const VARIANT: Readonly<Record<ButtonVariant, string>> = {
  // 主操作：实心 accent + 光晕。光晕强度跟主题 --glow 走，gameboy 那种低发光主题会自动收敛
  primary: 'accent-glow border-transparent bg-accent text-on-accent hover:brightness-110',
  // 次操作：玻璃面，hover 时描边染上 accent
  secondary: 'glass text-text hover:border-accent-line hover:text-text',
  // 无框：只在 hover 时浮出一层底
  ghost: 'border-transparent bg-transparent text-muted hover:bg-surface-alt hover:text-text',
  // 危险操作。text-on-accent 在明暗主题下都跟 danger 有足够对比（见 theme/themes.ts 的配色约定）
  danger: 'border-transparent bg-danger text-on-accent hover:brightness-110',
  glass: 'glass-strong text-text hover:border-accent-line',
}

const SPINNER_SIZE: Readonly<Record<ButtonSize, 'xs' | 'sm'>> = { sm: 'xs', md: 'sm', lg: 'sm' }

/**
 * 通用按钮。
 * loading 时不卸载 icon 而是原地换成 Spinner，避免按钮宽度在提交瞬间抖一下。
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const leading = loading ? <Spinner size={SPINNER_SIZE[size]} label={null} /> : icon

  return (
    <button
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, SIZE[size], VARIANT[variant], fullWidth && 'w-full', className)}
      {...rest}
    >
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      {children}
      {iconRight ? <span className="flex shrink-0 items-center">{iconRight}</span> : null}
    </button>
  )
}
