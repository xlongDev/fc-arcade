import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'motion/react'

import { IconAlert, IconCheck, IconClose, IconInfo } from '@/components/icons'
import { cn } from '@/lib/cn'
import type { Toast, ToastVariant } from '@/types/ui'

import { IconButton } from './IconButton'
import {
  dismissAllToasts,
  dismissToast,
  getToasts,
  pushToast,
  subscribeToasts,
} from './toastStore'
import type { ToastInput } from './toastStore'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface ToastApi {
  /** 推一条提示，返回 id */
  toast: (input: ToastInput) => string
  /** 手动关掉某条 */
  dismiss: (id: string) => void
  dismissAll: () => void
}

/**
 * 取 toast API。
 * 底层是模块级 store，所以在 ToastViewport 之外的任何组件里都能调，
 * 不需要 Provider 包裹。
 */
export function useToast(): ToastApi {
  const toast = useCallback((input: ToastInput) => pushToast(input), [])
  const dismiss = useCallback((id: string) => dismissToast(id), [])
  const dismissAll = useCallback(() => dismissAllToasts(), [])
  return useMemo(() => ({ toast, dismiss, dismissAll }), [toast, dismiss, dismissAll])
}

const ICON: Readonly<Record<ToastVariant, typeof IconInfo>> = {
  info: IconInfo,
  success: IconCheck,
  warning: IconAlert,
  error: IconAlert,
}

const TONE: Readonly<Record<ToastVariant, string>> = {
  info: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = ICON[toast.variant]
  const reduce = usePrefersReducedMotion()

  return (
    <m.li
      layout={reduce ? false : 'position'}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 32, scale: 0.95 }}
      transition={
        reduce ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 34, mass: 0.7 }
      }
      className="glass-strong pointer-events-auto flex w-full items-start gap-3 rounded-xl px-4 py-3"
    >
      <span className={cn('mt-0.5 flex shrink-0 items-center', TONE[toast.variant])}>
        <Icon size={17} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm leading-snug font-medium text-text">{toast.title}</p>
        {toast.description === undefined ? null : (
          <p className="text-xs leading-relaxed text-muted">{toast.description}</p>
        )}
      </div>

      <IconButton
        label="关闭提示"
        size="sm"
        variant="ghost"
        className="-mt-1 -mr-1.5"
        onClick={() => onDismiss(toast.id)}
      >
        <IconClose size={14} />
      </IconButton>
    </m.li>
  )
}

/**
 * 提示容器。整个应用挂一个，放在 App 根部。
 * 桌面右下、移动端顶部——移动端底部通常被虚拟手柄和 TabBar 占着。
 */
export function ToastViewport() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)

  return createPortal(
    <ul
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'pointer-events-none fixed z-300 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2',
        'top-[max(0.75rem,var(--safe-top))] right-3 sm:top-auto sm:bottom-5 sm:right-5',
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </ul>,
    document.body,
  )
}
