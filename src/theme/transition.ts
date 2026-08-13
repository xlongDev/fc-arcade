/**
 * 主题切换的视觉过渡。
 *
 * 统一走「轻量 CSS 自定义属性过渡」：切换 <html data-theme / data-mode> 后给
 * <html> 挂一个 class（.theme-transition），由 index.css 里注册的 @property +
 * transition 规则把 --color-* / --radius-* / --glass-blur 等属性平滑插值。
 *
 * 关键点：不依赖 View Transitions API 的整页快照。VT 的圆形 clip-path 揭示会
 * 对全页位图做「捕获 + 逐帧重光栅化」，在元素多的页面（游戏库网格）就是
 * 「卡顿一下 + 不流畅」的根因。@property 路径零位图、零重绘，由合成器做颜色
 * 插值，绝对流畅。
 *
 * prefers-reduced-motion 下跳过过渡，直接换。
 */

export interface TransitionOrigin {
  x: number
  y: number
}

const FALLBACK_CLASS = 'theme-transition'
const FALLBACK_MS = 300

let fallbackTimer: number | undefined

/**
 * 执行一次带过渡的主题变更。
 * @param apply 真正修改 DOM / React 状态的回调（无需同步 flushSync，
 *              data-theme/data-mode 属性已同步切换，CSS 变量立即生效）
 * @param _origin 兼容旧签名保留（圆形揭示已弃用）
 * @param reduceMotion 是否减弱动效
 */
export function runThemeTransition(
  apply: () => void,
  _origin?: TransitionOrigin,
  reduceMotion = false,
): void {
  if (typeof document === 'undefined') {
    apply()
    return
  }

  if (reduceMotion) {
    apply()
    return
  }

  const root = document.documentElement
  root.classList.add(FALLBACK_CLASS)
  apply()

  // 连切时只重置一次计时器，避免 class 被提前移除打断过渡
  if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
  fallbackTimer = window.setTimeout(() => {
    root.classList.remove(FALLBACK_CLASS)
    fallbackTimer = undefined
  }, FALLBACK_MS)
}

/**
 * 取消当前过渡（快速连切时清掉残留 class / 计时器）。
 */
export function cancelActiveTransition(): void {
  if (fallbackTimer !== undefined) {
    window.clearTimeout(fallbackTimer)
    fallbackTimer = undefined
  }
  document.documentElement.classList.remove(FALLBACK_CLASS)
}

/** 从鼠标/触摸事件里取切换动画的圆心（兼容旧调用，现仅保留 API） */
export function originFromEvent(event: { clientX: number; clientY: number }): TransitionOrigin {
  return { x: event.clientX, y: event.clientY }
}
