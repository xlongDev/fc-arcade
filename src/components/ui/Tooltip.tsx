import { cloneElement, useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, MouseEvent, ReactElement, ReactNode, Ref } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'

import { cn } from '@/lib/cn'

import { computeAnchorPosition } from './anchor'
import type { AnchorAlign, AnchorSide, Point } from './anchor'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/** Tooltip 会往 children 上追加的那几个 prop */
interface TriggerProps {
  ref?: Ref<HTMLElement>
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  'aria-describedby'?: string
}

export interface TooltipProps {
  content: ReactNode
  /** 单个可接收 ref 的元素。Tooltip 不会额外包 DOM，所以不会打乱 flex 间距 */
  children: ReactElement<TriggerProps>
  side?: AnchorSide
  align?: AnchorAlign
  /** 悬停多久才浮出，毫秒 */
  delayMs?: number
  disabled?: boolean
  className?: string
}

/**
 * 提示气泡。
 *
 * 刻意用 cloneElement 把事件和 ref 打到 children 本体上，而不是外面套一层 <span>：
 * 调用方（TopNav、StorageMeter）都把 Tooltip 直接放在 flex 行里，多一层壳会在
 * children 被 `hidden lg:flex` 隐藏时留下一份 gap。
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayMs = 120,
  disabled = false,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Point | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const floatRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const id = useId()
  const reduce = usePrefersReducedMotion()

  const cancel = useCallback(() => {
    window.clearTimeout(timerRef.current)
  }, [])

  const show = useCallback(() => {
    if (disabled) return
    cancel()
    timerRef.current = window.setTimeout(() => setOpen(true), delayMs)
  }, [cancel, delayMs, disabled])

  const hide = useCallback(() => {
    cancel()
    setOpen(false)
    setPos(null)
  }, [cancel])

  // 浮层挂上去之后才知道它多大，量完再定位。首帧透明，看不出这一跳
  useLayoutEffect(() => {
    if (!open) return
    const anchor = triggerRef.current
    const floating = floatRef.current
    if (!anchor || !floating) return
    const box = floating.getBoundingClientRect()
    setPos(
      computeAnchorPosition(
        anchor.getBoundingClientRect(),
        { width: box.width, height: box.height },
        side,
        align,
        8,
      ),
    )
  // content 变化时也要重新定位（内容尺寸可能改变），即便 body 不直接读取 content。
  // eslint-disable-next-line react/exhaustive-effect-dependencies
  }, [open, side, align, content])

  // eslint-disable-next-line react/refs -- ref 回调只在本组件内更新 triggerRef，不读取外部 ref，属安全用法
  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node
    },
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      children.props.onMouseEnter?.(event)
      show()
    },
    onMouseLeave: (event: MouseEvent<HTMLElement>) => {
      children.props.onMouseLeave?.(event)
      hide()
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      children.props.onFocus?.(event)
      show()
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      children.props.onBlur?.(event)
      hide()
    },
    'aria-describedby': open ? id : children.props['aria-describedby'],
  })

  return (
    <>
      {trigger}
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={floatRef}
              id={id}
              role="tooltip"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: pos === null ? 0 : 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              transition={{ duration: reduce ? 0 : 0.14, ease: [0.2, 0.9, 0.25, 1] }}
              style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
              className={cn(
                'glass-strong pointer-events-none fixed z-200 max-w-72 rounded-lg px-2.5 py-1.5',
                'text-xs leading-snug text-text',
                className,
              )}
            >
              {content}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
