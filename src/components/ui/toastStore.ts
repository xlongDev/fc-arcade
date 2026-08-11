import { uid } from '@/lib/id'
import type { Toast, ToastVariant } from '@/types/ui'

export interface ToastInput {
  variant?: ToastVariant
  title: string
  description?: string
  /** 0 表示不自动消失，需要用户手动关 */
  durationMs?: number
  /** 传同一个 id 会就地替换掉上一条，用于「进度类」提示的原地更新 */
  id?: string
}

const DEFAULT_DURATION: Readonly<Record<ToastVariant, number>> = {
  info: 3200,
  success: 3200,
  warning: 4800,
  error: 6000,
}

/** 同屏最多几条，超了从最老的开始丢 */
const MAX_VISIBLE = 4

/**
 * Toast 的真身放在模块作用域，不挂 React context。
 *
 * 这样 useToast() 在树里任何位置都能用，不必被 ToastViewport 包住——
 * ImportWizard 就是在 Provider 之外调它的。代价是同一页只能有一个 viewport，
 * 对这个站来说完全够用。
 */
let toasts: Toast[] = []
const listeners = new Set<() => void>()
const timers = new Map<string, number>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getToasts(): readonly Toast[] {
  return toasts
}

export function dismissToast(id: string): void {
  const timer = timers.get(id)
  if (timer !== undefined) {
    window.clearTimeout(timer)
    timers.delete(id)
  }
  const next = toasts.filter((item) => item.id !== id)
  if (next.length === toasts.length) return
  toasts = next
  emit()
}

export function dismissAllToasts(): void {
  for (const timer of timers.values()) window.clearTimeout(timer)
  timers.clear()
  if (toasts.length === 0) return
  toasts = []
  emit()
}

/** 推一条提示，返回它的 id（可用于提前 dismiss 或后续替换） */
export function pushToast(input: ToastInput): string {
  const variant = input.variant ?? 'info'
  const id = input.id ?? uid('toast')
  const durationMs = input.durationMs ?? DEFAULT_DURATION[variant]

  const toast: Toast = {
    id,
    variant,
    title: input.title,
    ...(input.description === undefined ? {} : { description: input.description }),
    durationMs,
  }

  const existing = toasts.findIndex((item) => item.id === id)
  if (existing >= 0) {
    const timer = timers.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    toasts = toasts.map((item) => (item.id === id ? toast : item))
  } else {
    toasts = [...toasts, toast].slice(-MAX_VISIBLE)
  }

  if (durationMs > 0) {
    timers.set(
      id,
      window.setTimeout(() => dismissToast(id), durationMs),
    )
  }

  emit()
  return id
}
