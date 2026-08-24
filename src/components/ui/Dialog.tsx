import { useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'motion/react'

import { IconClose } from '@/components/icons'
import { cn } from '@/lib/cn'

import { IconButton } from './IconButton'
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from './overlay'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'

export interface DialogProps {
  open: boolean
  /** Escape、点遮罩、点右上角关闭都会走这里。需要「忙碌时不可关」就传一个空函数 */
  onClose: () => void
  title?: string
  description?: string
  /** 底部操作区，通常放一排 <Button> */
  footer?: ReactNode
  size?: DialogSize
  /** 关掉右上角的关闭按钮（比如强制用户从 footer 走流程） */
  hideCloseButton?: boolean
  /** 点遮罩不关闭 */
  disableBackdropClose?: boolean
  className?: string
  children?: ReactNode
}

const SIZE: Readonly<Record<DialogSize, string>> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

/**
 * 模态对话框。
 *
 * 结构：portal → 遮罩 → 面板（glass-strong）。
 * 面板本体做 scale + y 的弹入；降级偏好下只剩不透明度变化。
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  hideCloseButton = false,
  disableBackdropClose = false,
  className,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const reduce = usePrefersReducedMotion()

  useBodyScrollLock(open)
  useEscapeKey(open, onClose)
  useFocusTrap(open, panelRef)

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-100 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={disableBackdropClose ? undefined : onClose}
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
          />

          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title === undefined ? undefined : titleId}
            aria-describedby={description === undefined ? undefined : descId}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={
              reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32, mass: 0.85 }
            }
            className={cn(
              'glass-strong relative flex max-h-[92dvh] w-full flex-col overflow-hidden outline-none',
              'rounded-t-huge sm:rounded-huge',
              SIZE[size],
              className,
            )}
          >
            {title !== undefined || !hideCloseButton ? (
              <header className="flex items-start gap-4 px-5 pt-5 sm:px-7 sm:pt-6">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {title !== undefined ? (
                    <h2 id={titleId} className="text-base font-medium text-text">
                      {title}
                    </h2>
                  ) : null}
                  {description !== undefined ? (
                    <p id={descId} className="text-xs leading-relaxed text-muted">
                      {description}
                    </p>
                  ) : null}
                </div>
                {hideCloseButton ? null : (
                  <IconButton label="关闭" size="sm" variant="ghost" onClick={onClose}>
                    <IconClose size={16} />
                  </IconButton>
                )}
              </header>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>

            {footer ? (
              <footer className="border-t border-border px-5 py-4 pb-[max(1rem,var(--safe-bottom))] sm:px-7 sm:pb-4">
                {footer}
              </footer>
            ) : null}
          </m.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
