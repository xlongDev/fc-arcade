import type { Transition, Variants } from 'motion/react'

/** 主用 spring：卡片浮动、布局 morph */
export const SPRING: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }

/** 柔一点的 spring：面板展开、页面转场 */
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 260, damping: 30, mass: 1 }

/** 短促 spring：按钮、开关等小控件 */
export const SPRING_SNAP: Transition = { type: 'spring', stiffness: 620, damping: 32, mass: 0.6 }

/** 削减动效时统一替换为几乎瞬时的补间 */
export const INSTANT: Transition = { duration: 0 }

export function pick(reduce: boolean, transition: Transition): Transition {
  return reduce ? INSTANT : transition
}

/** 页面级转场 */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(6px)' },
}

export const pageVariantsReduced: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

/** 列表项入场：虚拟化关闭时使用 */
export const itemVariants: Variants = {
  initial: { opacity: 0, scale: 0.94, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94, y: -8 },
}

export const itemVariantsReduced: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

/** 覆盖层淡入 */
export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}
