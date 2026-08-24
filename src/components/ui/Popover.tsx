import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactElement, ReactNode, Ref } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'motion/react'

import { cn } from '@/lib/cn'

import { computeAnchorPosition } from './anchor'
import type { AnchorAlign, AnchorSide, Point } from './anchor'
import { useEscapeKey } from './overlay'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/** 浮层到视口边缘的最小间距（centerOnViewport 模式下遵守） */
const VIEWPORT_MARGIN = 8

interface TriggerProps {
  ref?: Ref<HTMLElement>
  onClick?: (event: MouseEvent<HTMLElement>) => void
  'aria-expanded'?: boolean
  'aria-haspopup'?: 'dialog'
}

export interface PopoverProps {
  /** 触发元素。点击切换开合，Popover 会往它身上补 aria-expanded */
  trigger: ReactElement<TriggerProps>
  children: ReactNode
  side?: AnchorSide
  align?: AnchorAlign
  /** 受控用法；不传就自己管开合 */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  /**
   * 不按 trigger 锚点定位，直接钉死在视口几何中心。
   * 用在「面板该是全屏居中 modal，不该跟着触发器跑」的场景
   * （比如播放器底栏存档按钮，最左侧时按它锚就把面板拉到屏幕左半边）。
   */
  centerOnViewport?: boolean
}

/**
 * 轻量浮层。用在桌面端的筛选面板这类「不该打断主流程」的场景，
 * 窄屏那边通常换成 <Sheet>。点外部、Escape、滚动祖先都会关。
 */
export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'center',
  open: controlledOpen,
  onOpenChange,
  className,
  centerOnViewport = false,
}: PopoverProps) {
  const [uncontrolled, setUncontrolled] = useState(false)
  const open = controlledOpen ?? uncontrolled
  const [pos, setPos] = useState<Point | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const floatRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const reduce = usePrefersReducedMotion()

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolled(next)
      onOpenChange?.(next)
    },
    [controlledOpen, onOpenChange],
  )

  // 全屏场景下浏览器只渲染全屏元素及其子树，portal 到 document.body（全屏元素之外）
  // 会导致浮层不可见。因此存在全屏元素时把浮层挂到它下面，保证存档 / 音量等面板在
  // 全屏播放器里也能正常弹出。
  const portalTarget = document.fullscreenElement ?? document.body

  useEscapeKey(open, () => setOpen(false))

  useLayoutEffect(() => {
    if (!open) {
      // 与 open 外部状态同步：关闭时清空定位，属于 effect 与交互状态同步。
      // eslint-disable-next-line react/set-state-in-effect
      setPos(null)
      return
    }
    const floating = floatRef.current
    if (!floating) return
    const box = floating.getBoundingClientRect()
    if (centerOnViewport) {
      const vw = window.innerWidth
      const vh = window.innerHeight
      setPos({
        top: Math.max(VIEWPORT_MARGIN, vh / 2 - box.height / 2),
        left: Math.max(VIEWPORT_MARGIN, vw / 2 - box.width / 2),
      })
      return
    }
    const anchor = anchorRef.current
    if (!anchor) return
    setPos(
      computeAnchorPosition(
        anchor.getBoundingClientRect(),
        { width: box.width, height: box.height },
        side,
        align,
        10,
      ),
    )
  }, [open, side, align, centerOnViewport])

  // 点到浮层和触发器之外就关。用 pointerdown 而不是 click，
  // 否则点击其它按钮时会先触发它的 onClick 再关闭，观感上慢半拍
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (floatRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      setOpen(false)
    }
    // 浮层本身的内容滚动不应关闭（10 个存档槽位超出视口时要能滚），
    // 只对浮层/触发器之外的滚动（祖先容器、窗口主滚动条）响应。
    const onScroll = (event: Event) => {
      const target = event.target
      if (target instanceof Node) {
        if (floatRef.current?.contains(target)) return
        if (anchorRef.current?.contains(target)) return
      }
      setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
    // setOpen 已用 useCallback 稳定（只在 controlledOpen / onOpenChange 变化时变），
    // 纳进依赖是安全的，不会让监听器每帧重挂
  }, [open, setOpen])

  // eslint-disable-next-line react/refs -- ref 回调只在本组件内更新 anchorRef，不读取外部 ref，属安全用法
  const anchor = cloneElement(trigger, {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      trigger.props.onClick?.(event)
      setOpen(!open)
    },
    'aria-expanded': open,
    'aria-haspopup': 'dialog',
  })

  return (
    <>
      {anchor}
      {createPortal(
        <AnimatePresence>
          {open && portalTarget ? (
            <m.div
              ref={floatRef}
              id={id}
              role="dialog"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: pos === null ? 0 : 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              transition={
                reduce ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 34, mass: 0.7 }
              }
              style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
              className={cn(
                'glass-strong fixed z-100 max-h-[70dvh] overflow-y-auto rounded-xl p-4',
                className,
              )}
            >
              {children}
            </m.div>
          ) : null}
        </AnimatePresence>,
        portalTarget,
      )}
    </>
  )
}
