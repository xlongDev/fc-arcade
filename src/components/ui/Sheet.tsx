import { useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'

import { IconClose } from '@/components/icons'
import { cn } from '@/lib/cn'

import { IconButton } from './IconButton'
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from './overlay'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export type SheetSide = 'bottom' | 'right'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  side?: SheetSide
  footer?: ReactNode
  className?: string
  children?: ReactNode
}

const OFFSCREEN: Readonly<Record<SheetSide, { x?: number; y?: string }>> = {
  bottom: { y: '100%' },
  right: { x: 480 },
}

/**
 * 移动端抽屉。桌面端的 Popover 内容在窄屏改用它承载，交互目标更大。
 * 顶部留一条拖拽提示横杠（纯视觉，真正的关闭还是靠遮罩 / Escape / 关闭按钮）。
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  side = 'bottom',
  footer,
  className,
  children,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const reduce = usePrefersReducedMotion()

  useBodyScrollLock(open)
  useEscapeKey(open, onClose)
  useFocusTrap(open, panelRef)

  const offscreen = OFFSCREEN[side]

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className={cn(
            'fixed inset-0 z-100 flex',
            side === 'bottom' ? 'items-end justify-center' : 'items-stretch justify-end',
          )}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title === undefined ? undefined : titleId}
            aria-describedby={description === undefined ? undefined : descId}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, ...offscreen }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, ...offscreen }}
            transition={
              reduce ? { duration: 0 } : { type: 'spring', stiffness: 340, damping: 34, mass: 0.9 }
            }
            className={cn(
              'glass-strong relative flex flex-col overflow-hidden outline-none',
              side === 'bottom'
                ? 'max-h-[88dvh] w-full rounded-t-huge'
                : 'h-full w-full max-w-md rounded-l-huge',
              className,
            )}
          >
            {side === 'bottom' ? (
              <div aria-hidden="true" className="flex justify-center pt-2.5">
                <span className="h-1 w-10 rounded-full bg-faint/50" />
              </div>
            ) : null}

            <header className="flex items-start gap-4 px-5 pt-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {title === undefined ? null : (
                  <h2 id={titleId} className="text-base font-medium text-text">
                    {title}
                  </h2>
                )}
                {description === undefined ? null : (
                  <p id={descId} className="text-xs leading-relaxed text-muted">
                    {description}
                  </p>
                )}
              </div>
              <IconButton label="关闭" size="sm" variant="ghost" onClick={onClose}>
                <IconClose size={16} />
              </IconButton>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-[max(1.25rem,var(--safe-bottom))]">
              {children}
            </div>

            {footer ? <footer className="border-t border-border px-5 py-4">{footer}</footer> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
