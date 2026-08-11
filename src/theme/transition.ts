/**
 * 主题切换的视觉过渡。
 *
 * 首选 View Transitions API：从点击位置做一个圆形 clip-path 揭示。
 * 不支持的浏览器降级成 300ms 的全局颜色过渡（给 <html> 挂一个 class，
 * 由 index.css 里的 .theme-transition 规则接管）。
 * prefers-reduced-motion 下两者都跳过，直接换。
 */

export interface TransitionOrigin {
  x: number
  y: number
}

interface ViewTransitionLike {
  ready: Promise<void>
  finished: Promise<void>
}

type StartViewTransition = (callback: () => void) => ViewTransitionLike

const FALLBACK_CLASS = 'theme-transition'
const FALLBACK_MS = 300
const REVEAL_MS = 560

let fallbackTimer: number | undefined

function runFallback(apply: () => void): void {
  const root = document.documentElement
  root.classList.add(FALLBACK_CLASS)
  apply()
  if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
  fallbackTimer = window.setTimeout(() => {
    root.classList.remove(FALLBACK_CLASS)
    fallbackTimer = undefined
  }, FALLBACK_MS)
}

/**
 * 执行一次带过渡的主题变更。
 * @param apply 真正修改 DOM / React 状态的回调，必须是同步的
 */
export function runThemeTransition(
  apply: () => void,
  origin?: TransitionOrigin,
  reduceMotion = false,
): void {
  if (typeof document === 'undefined') {
    apply()
    return
  }

  const doc = document as Document & { startViewTransition?: StartViewTransition }

  if (reduceMotion) {
    apply()
    return
  }

  if (typeof doc.startViewTransition !== 'function') {
    runFallback(apply)
    return
  }

  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? window.innerHeight / 2
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

  const transition = doc.startViewTransition(apply)

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
        },
        {
          duration: REVEAL_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    })
    // 过渡被打断（连点换主题）时 ready 会 reject，忽略即可
    .catch(() => undefined)
}

/** 从鼠标/触摸事件里取切换动画的圆心 */
export function originFromEvent(event: { clientX: number; clientY: number }): TransitionOrigin {
  return { x: event.clientX, y: event.clientY }
}
