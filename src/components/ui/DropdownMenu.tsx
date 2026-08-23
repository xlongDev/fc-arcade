import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { createPortal } from 'react-dom'

import { IconCheck, IconChevronDown } from '@/components/icons'
import { cn } from '@/lib/cn'

import { computeAnchorPosition } from './anchor'
import type { AnchorAlign, AnchorSide, Point } from './anchor'
import { useEscapeKey } from './overlay'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/* ------------------------------------------------------------------ */
/*  类型                                                                */
/* ------------------------------------------------------------------ */

export interface DropdownOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
  icon?: ReactNode
}

export interface DropdownMenuProps<T extends string> {
  value: T
  onChange: (next: T) => void
  options: readonly DropdownOption[]
  size?: 'sm' | 'md'
  /** 左侧装饰图标 */
  icon?: ReactNode
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

const SIZE = {
  /** 与 Button size="sm" 完全一致：h-9 rounded-lg px-3 text-xs */
  sm: 'h-9 rounded-lg px-3 text-xs',
  md: 'h-10 rounded-xl pl-3 text-sm',
} as const

/** 单个选项的入场/退出动画 */
const itemVariants = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
}

const panelVariants = {
  initial: { opacity: 0, y: -6, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
}

/* ------------------------------------------------------------------ */
/*  组件                                                                */
/* ------------------------------------------------------------------ */

/**
 * 自定义下拉菜单。
 *
 * 用 Popover 风格的浮动面板替代原生 <select>，支持：
 * - 平滑的展开/收起动画（spring）
 * - 选项逐项交错入场（stagger）
 * - 当前选中项带勾选标记
 * - 点击外部 / Escape 关闭
 * - 键盘上下方向键导航
 */
export function DropdownMenu<T extends string>({
  value,
  onChange,
  options,
  size = 'sm',
  icon,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: DropdownMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Point | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const floatRef = useRef<HTMLDivElement>(null)
  const reduce = usePrefersReducedMotion()
  const [focusedIndex, setFocusedIndex] = useState(-1)

  const currentLabel = options.find((o) => o.value === value)?.label ?? value

  useEscapeKey(open, () => setOpen(false))

  // 计算浮层位置
  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    const floating = floatRef.current
    if (!anchor || !floating) return
    const box = floating.getBoundingClientRect()
    setPos(
      computeAnchorPosition(
        anchor.getBoundingClientRect(),
        { width: box.width, height: box.height },
        'bottom' as AnchorSide,
        'end' as AnchorAlign,
        8,
      ),
    )
  }, [])

  // 打开时计算位置 + 监听滚动/resize 关闭
  const toggle = useCallback(
    (next: boolean) => {
      if (disabled) return
      setOpen(next)
      setFocusedIndex(-1)
      if (next) {
        // 延一帧等 DOM 更新后再测量
        requestAnimationFrame(updatePosition)
      }
    },
    [disabled, updatePosition],
  )

  // 键盘导航
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!open) {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toggle(true)
        }
        return
      }

      const usable = options.filter((o) => !o.disabled)
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setFocusedIndex(Math.min(focusedIndex + 1, usable.length - 1))
          break
        case 'ArrowUp':
          event.preventDefault()
          setFocusedIndex(Math.max(focusedIndex - 1, 0))
          break
        case 'Enter':
        case ' ': {
          event.preventDefault()
          const item = usable[focusedIndex]
          if (item) {
            onChange(item.value as T)
            toggle(false)
          }
          break
        }
        case 'Escape':
          event.preventDefault()
          toggle(false)
          break
      }
    },
    [open, options, onChange, toggle, focusedIndex],
  )

  const selectOption = (optionValue: T) => {
    onChange(optionValue)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => toggle(!open)}
        onBlur={() => {
          // 延迟关闭，让点击选项的事件先触发
          setTimeout(() => setOpen(false), 150)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'relative inline-flex items-center gap-2 border border-border bg-surface-alt/60 pr-2',
          'transition-[border-color,box-shadow] duration-200 ease-snap hover:border-accent-line',
          open && 'border-accent shadow-sm shadow-accent/10',
          'focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          disabled && 'pointer-events-none opacity-45',
          SIZE[size],
          className,
        )}
      >
        {icon ? <span className="flex shrink-0 items-center text-faint">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate text-text">{currentLabel}</span>
        <IconChevronDown
          size={14}
          className={cn('shrink-0 text-faint transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {/* 浮动面板 */}
      {open &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={floatRef}
              role="listbox"
              variants={panelVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 520, damping: 38, mass: 0.65 }
              }
              style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
              className="fixed z-100 min-w-[160px]"
            >
              {/* 与触发按钮之间的视觉桥 */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-1.5 right-3 h-2 w-4"
                style={{ perspective: '8px' }}
              >
                <div
                  className="h-full w-full border-x border-t border-glass-border"
                  style={{
                    backgroundColor: 'color-mix(in oklab, var(--color-surface) 78%, transparent)',
                    borderTopLeftRadius: '3px',
                    borderTopRightRadius: '3px',
                    transform: 'rotateX(28deg)',
                    transformOrigin: 'bottom',
                  }}
                />
              </div>

              <div className="glass-strong overflow-hidden rounded-xl shadow-lift">
                {options.map((option, i) => {
                  const active = option.value === value
                  const isFocused = focusedIndex === i
                  return (
                    <motion.button
                      key={option.value}
                      role="option"
                      aria-selected={active}
                      tabIndex={-1}
                      disabled={option.disabled}
                      variants={itemVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{
                        delay: reduce ? 0 : i * 0.03,
                        type: 'spring' as const,
                        stiffness: 420,
                        damping: 34,
                      }}
                      onClick={() => selectOption(option.value as T)}
                      onMouseEnter={() => { setFocusedIndex(i) }}
                      className={cn(
                        'relative flex h-9 w-full items-center gap-2 px-3 text-left text-xs',
                        'transition-colors duration-150',
                        active
                          ? 'bg-accent-soft/20 text-text font-medium'
                          : 'text-text hover:bg-surface/60',
                        option.disabled && 'pointer-events-none opacity-40',
                        isFocused && !option.disabled && !active && 'bg-accent-soft/15',
                      )}
                    >
                      {/* 左侧 accent 指示条 */}
                      <span
                        className={cn(
                          'absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent transition-transform duration-200 ease-snap',
                          active ? 'scale-y-100' : 'scale-y-0',
                        )}
                      />

                      {/* 选中圆点 */}
                      <span
                        className={cn(
                          'flex size-3.5 shrink-0 items-center justify-center rounded-full transition-colors duration-150',
                          active
                            ? 'bg-accent/15 text-accent'
                            : 'text-transparent',
                        )}
                      >
                        <IconCheck size={9} strokeWidth={3} />
                      </span>
                      <span className="flex-1 truncate">{option.label}</span>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
