import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/** 能接收焦点的元素。用于弹层打开时的初始聚焦和 Tab 循环 */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * 锁住 body 滚动。
 * 计数式：多层弹层叠着开的时候，最后一层关掉才真正解锁。
 */
let lockCount = 0
let savedOverflow = ''
let savedPaddingRight = ''

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return

    if (lockCount === 0) {
      const { body } = document
      // 补上滚动条宽度，否则锁定瞬间整页会横向跳一下
      const gap = window.innerWidth - document.documentElement.clientWidth
      savedOverflow = body.style.overflow
      savedPaddingRight = body.style.paddingRight
      body.style.overflow = 'hidden'
      if (gap > 0) body.style.paddingRight = `${gap}px`
    }
    lockCount += 1

    return () => {
      lockCount -= 1
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow
        document.body.style.paddingRight = savedPaddingRight
      }
    }
  }, [active])
}

/** Escape 关闭。挂在 document 上，capture 阶段之外，谁在上层谁先关由调用顺序保证。 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  const handler = useRef(onEscape)
  // 在 effect 中同步最新回调，避免渲染期写 ref（react/refs）。
  useEffect(() => {
    handler.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handler.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active])
}

/**
 * 打开时把焦点移进弹层、Tab 在弹层内循环、关闭时还给原来的元素。
 * 不是完整的 inert 实现（背景内容仍能被读屏遍历），但键盘用户不会再 Tab 丢到背景里。
 */
export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const first = container.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? container).focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const head = items[0]
      const tail = items[items.length - 1]
      if (head === undefined || tail === undefined) return

      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault()
        tail.focus()
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault()
        head.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      previous?.focus({ preventScroll: true })
    }
  }, [active, containerRef])
}
