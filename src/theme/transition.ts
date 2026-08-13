/**
 * 主题切换的视觉过渡：圆形揭示（circular reveal）。
 *
 * 保留「圆形揭示真实界面」的观感，但彻底避开 View Transitions 的整页位图快照
 * （那才是复杂页面「卡顿一下 + 不流畅」的根因），改用一个纯 DOM overlay：
 *
 *   1. 读取当前 body 的实际渲染背景色（旧主题真实底色）作为遮罩色。
 *   2. 铺一个 fixed 全屏 overlay，clip-path = circle(全覆盖) 盖住整屏（旧底色）。
 *   3. 立即 apply() 切换主题到新主题——此时新主题已被 overlay 遮住，用户无感跳变。
 *   4. 下一帧把 overlay 的 clip-path 收到 circle(0)（收缩到点击点）。
 *      收缩过程中，未被遮罩覆盖的区域露出「新主题的真实 UI」，
 *      于是旧主题像被吸进点击点一样退去，新界面原地呈现，圆形揭示真实界面。
 *   5. 动画结束后移除 overlay。
 *
 * 全程只动一个 div 的 clip-path（合成器层操作，零位图、零重绘），
 * 比 VT 的整页快照流畅得多。prefers-reduced-motion 下跳过过渡直接换。
 */

export interface TransitionOrigin {
  x: number
  y: number
}

const DEFAULT_DURATION = 760

/**
 * 取当前主题的真实渲染背景色，作为遮罩色。
 *
 * 直接读 computedStyle.backgroundColor 而非 --color-bg 变量：
 * - @property 注册后 + light-dark() / var() 链式引用时，
 *   getPropertyValue('--color-bg') 可能返回未解析的 token 或初始值，
 *   导致遮罩始终是白色/默认色。
 * - backgroundColor 是浏览器已经合成到屏幕的真实颜色，永远可靠。
 *
 * 注意：fc-arcade 的页面背景是设在 <body> 上的
 * （styles/index.css：`body { background-color: var(--color-bg) }`），
 * 所以优先读 document.body；html 仅作为兜底。
 * 这样 24 套主题各自底色（pacman 黑机柜 / castlevania 血色近黑 /
 * gameboy 墨绿 / woodgrain 胡桃木 …）都能被正确取到。
 */
function readCurrentBackground(): string {
  if (typeof document === 'undefined') return '#000'
  const bodyBg = getComputedStyle(document.body).backgroundColor
  if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
    return bodyBg
  }
  const htmlBg = getComputedStyle(document.documentElement).backgroundColor
  if (htmlBg && htmlBg !== 'rgba(0, 0, 0, 0)' && htmlBg !== 'transparent') {
    return htmlBg
  }
  return getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#000'
}

/** 点击点到视口四角的最大距离，保证圆形能完全覆盖屏幕 */
function maxRadius(x: number, y: number): number {
  const w = window.innerWidth
  const h = window.innerHeight
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y))
}

/**
 * 执行一次带圆形揭示的主题变更。
 * @param apply 真正修改 DOM / React 状态的回调（无需 flushSync，
 *              data-theme/data-mode 属性已同步切换，CSS 变量立即生效）
 * @param origin 动画圆心（点击坐标）；缺省取屏幕中心
 * @param reduceMotion 是否减弱动效
 */
export function runThemeTransition(
  apply: () => void,
  origin?: TransitionOrigin,
  reduceMotion = false,
): void {
  if (typeof document === 'undefined' || reduceMotion) {
    apply()
    return
  }

  const bg = readCurrentBackground()
  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? window.innerHeight / 2
  const radius = maxRadius(x, y)

  const overlay = document.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.margin = '0'
  overlay.style.background = bg
  overlay.style.zIndex = '2147483646'
  overlay.style.pointerEvents = 'none'
  overlay.style.willChange = 'clip-path'
  overlay.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`
  document.body.appendChild(overlay)

  // 强制一次 reflow，让起始 clip-path 生效，避免被浏览器合并掉动画首帧
  void overlay.getBoundingClientRect()

  // 先切换主题（被 overlay 遮住，用户无感）
  apply()

  // 下一帧再收起遮罩，露出新主题真实 UI
  requestAnimationFrame(() => {
    overlay.style.transition = `clip-path ${DEFAULT_DURATION}ms cubic-bezier(0.65, 0, 0.35, 1)`
    overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`
  })

  let done = false
  const cleanup = (): void => {
    if (done) return
    done = true
    overlay.remove()
  }
  overlay.addEventListener('transitionend', cleanup, { once: true })
  // 兜底：若 transitionend 未触发（极端情况），超时也清理，避免遮罩残留
  window.setTimeout(cleanup, DEFAULT_DURATION + 200)
}

/** 从鼠标/触摸事件里取切换动画的圆心 */
export function originFromEvent(event: { clientX: number; clientY: number }): TransitionOrigin {
  return { x: event.clientX, y: event.clientY }
}
