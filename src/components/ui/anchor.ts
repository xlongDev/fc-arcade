export type AnchorSide = 'top' | 'bottom' | 'left' | 'right'
export type AnchorAlign = 'start' | 'center' | 'end'

export interface Size {
  width: number
  height: number
}

export interface Point {
  top: number
  left: number
}

const VIEWPORT_MARGIN = 8

/**
 * 把浮层摆到锚点旁边，坐标是 position: fixed 用的视口坐标。
 *
 * 只做两件事：按 side/align 算主位置；越界时翻到对侧、再夹回视口内。
 * 没有上 floating-ui —— 站里的浮层都很小，这点逻辑不值得多一个依赖。
 */
export function computeAnchorPosition(
  anchor: DOMRect,
  floating: Size,
  side: AnchorSide,
  align: AnchorAlign,
  gap: number,
): Point {
  const vw = window.innerWidth
  const vh = window.innerHeight

  let resolved = side
  // 放不下就翻到对侧
  if (side === 'bottom' && anchor.bottom + gap + floating.height > vh - VIEWPORT_MARGIN) {
    if (anchor.top - gap - floating.height > VIEWPORT_MARGIN) resolved = 'top'
  } else if (side === 'top' && anchor.top - gap - floating.height < VIEWPORT_MARGIN) {
    if (anchor.bottom + gap + floating.height < vh - VIEWPORT_MARGIN) resolved = 'bottom'
  } else if (side === 'right' && anchor.right + gap + floating.width > vw - VIEWPORT_MARGIN) {
    if (anchor.left - gap - floating.width > VIEWPORT_MARGIN) resolved = 'left'
  } else if (side === 'left' && anchor.left - gap - floating.width < VIEWPORT_MARGIN) {
    if (anchor.right + gap + floating.width < vw - VIEWPORT_MARGIN) resolved = 'right'
  }

  const vertical = resolved === 'top' || resolved === 'bottom'

  const top = vertical
    ? resolved === 'bottom'
      ? anchor.bottom + gap
      : anchor.top - gap - floating.height
    : alignAxis(anchor.top, anchor.height, floating.height, align)

  const left = vertical
    ? alignAxis(anchor.left, anchor.width, floating.width, align)
    : resolved === 'right'
      ? anchor.right + gap
      : anchor.left - gap - floating.width

  return {
    top: clamp(top, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vh - floating.height - VIEWPORT_MARGIN)),
    left: clamp(left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, vw - floating.width - VIEWPORT_MARGIN)),
  }
}

function alignAxis(start: number, anchorLength: number, floatLength: number, align: AnchorAlign) {
  if (align === 'start') return start
  if (align === 'end') return start + anchorLength - floatLength
  return start + anchorLength / 2 - floatLength / 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
