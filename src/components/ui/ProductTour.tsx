import type { ReactNode } from 'react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'motion/react'

import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { IconArrowLeft, IconArrowRight, IconClose } from '@/components/icons'
import { cn } from '@/lib/cn'

import { useEscapeKey, useFocusTrap } from './overlay'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export type TourStep = {
  /** 要高亮的页面元素 CSS 选择器；不传则居中展示欢迎卡片 */
  target?: string
  title: string
  description: string
  icon?: ReactNode
}

export interface ProductTourProps {
  open: boolean
  steps: TourStep[]
  onClose: () => void
  onComplete?: () => void
  /** 完成时写入 localStorage 的标记 key，不传则不自动记忆 */
  storageKey?: string
  className?: string
}

const SPOTLIGHT_PAD = 8
const SPOTLIGHT_RADIUS = 16
const CARD_GAP = 18
const VIEWPORT_MARGIN = 16

interface Rect {
  x: number
  y: number
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

function emptyRect(): Rect {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const x = cx - 60
  const y = cy - 30
  return { x, y, left: x, top: y, right: x + 120, bottom: y + 60, width: 120, height: 60 }
}

function getTargetRect(selector: string | undefined): Rect {
  if (!selector) return emptyRect()
  const el = document.querySelector(selector)
  if (!el) return emptyRect()
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return emptyRect()
  return rect
}

function cardPosition(
  target: Rect,
  cardWidth: number,
  cardHeight: number,
): { top: number; left: number; side: 'top' | 'bottom' | 'left' | 'right' } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // 小屏：卡片钉在底部中央
  if (vw < 640) {
    return {
      top: Math.min(target.bottom + CARD_GAP, vh - cardHeight - VIEWPORT_MARGIN),
      left: Math.max(VIEWPORT_MARGIN, Math.min(vw - cardWidth - VIEWPORT_MARGIN, (vw - cardWidth) / 2)),
      side: 'bottom',
    }
  }

  // 优先放右侧；放不下换左侧；再不行放上下
  const fitsRight = target.right + CARD_GAP + cardWidth <= vw - VIEWPORT_MARGIN
  const fitsLeft = target.left - CARD_GAP - cardWidth >= VIEWPORT_MARGIN
  const fitsBottom = target.bottom + CARD_GAP + cardHeight <= vh - VIEWPORT_MARGIN
  const fitsTop = target.top - CARD_GAP - cardHeight >= VIEWPORT_MARGIN

  const centerX = target.left + target.width / 2
  const centerY = target.top + target.height / 2

  let side: 'top' | 'bottom' | 'left' | 'right'
  let top: number
  let left: number

  if (centerX < vw * 0.35 && fitsRight) {
    side = 'right'
    top = clamp(centerY - cardHeight / 2, VIEWPORT_MARGIN, vh - cardHeight - VIEWPORT_MARGIN)
    left = target.right + CARD_GAP
  } else if (centerX > vw * 0.65 && fitsLeft) {
    side = 'left'
    top = clamp(centerY - cardHeight / 2, VIEWPORT_MARGIN, vh - cardHeight - VIEWPORT_MARGIN)
    left = target.left - CARD_GAP - cardWidth
  } else if (centerY < vh * 0.4 && fitsBottom) {
    side = 'bottom'
    top = target.bottom + CARD_GAP
    left = clamp(centerX - cardWidth / 2, VIEWPORT_MARGIN, vw - cardWidth - VIEWPORT_MARGIN)
  } else if (fitsTop) {
    side = 'top'
    top = target.top - CARD_GAP - cardHeight
    left = clamp(centerX - cardWidth / 2, VIEWPORT_MARGIN, vw - cardWidth - VIEWPORT_MARGIN)
  } else if (fitsRight) {
    side = 'right'
    top = clamp(centerY - cardHeight / 2, VIEWPORT_MARGIN, vh - cardHeight - VIEWPORT_MARGIN)
    left = target.right + CARD_GAP
  } else if (fitsLeft) {
    side = 'left'
    top = clamp(centerY - cardHeight / 2, VIEWPORT_MARGIN, vh - cardHeight - VIEWPORT_MARGIN)
    left = target.left - CARD_GAP - cardWidth
  } else {
    // 兜底居中
    side = 'bottom'
    top = Math.max(VIEWPORT_MARGIN, (vh - cardHeight) / 2)
    left = Math.max(VIEWPORT_MARGIN, (vw - cardWidth) / 2)
  }

  return { top, left, side }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 产品引导巡游组件。
 *
 * 特性：
 * - 通过 SVG mask 在页面之上切出聚光灯，同时保持目标元素可交互；
 * - 卡片自动避让视口边缘，小屏时吸附底部；
 * - 步骤切换带缩放/位移动画，并尊重 prefers-reduced-motion；
 * - 支持 Escape 关闭、焦点循环、完成记忆。
 */
export function ProductTour({ open, steps, onClose, onComplete, storageKey, className }: ProductTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [cardSize, setCardSize] = useState({ width: 360, height: 220 })
  const reduce = usePrefersReducedMotion()
  const cardRef = useRef<HTMLDivElement>(null)
  const titleId = useId().replace(/:/g, '')
  const descId = useId().replace(/:/g, '')
  const maskId = useId().replace(/:/g, '')

  useEscapeKey(open, onClose)
  useFocusTrap(open, cardRef)

  const currentStep = steps[stepIndex]
  const hasSteps = steps.length > 0
  const isLast = stepIndex >= steps.length - 1
  const progress = hasSteps ? ((stepIndex + 1) / steps.length) * 100 : 0

  // 目标矩形在渲染期直接计算，不需要 effect
  const target = useMemo(() => (open && hasSteps ? getTargetRect(currentStep?.target) : emptyRect()), [open, hasSteps, currentStep])

  // 卡片位置依赖目标矩形与卡片实测尺寸，尺寸未知前先用默认值
  const cardPos = useMemo(
    () => cardPosition(target, cardSize.width, cardSize.height),
    [target, cardSize.width, cardSize.height],
  )

  // DOM 测量后修正卡片位置。这是唯一需要测量 DOM 后才能确定的位置，
  // 无法在渲染期完成，故用 layout effect 同步更新。
  // eslint-disable-next-line react/set-state-in-effect
  useLayoutEffect(() => {
    if (!open || !currentStep) return
    const card = cardRef.current
    if (!card) return
    const { width, height } = card.getBoundingClientRect()
    setCardSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
  }, [open, currentStep])

  // 窗口/滚动变化时重新测量并定位
  useEffect(() => {
    if (!open) return
    const measure = () => {
      const card = cardRef.current
      if (!card) return
      const { width, height } = card.getBoundingClientRect()
      setCardSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open])

  // 每次打开时回到第一步。
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react/set-state-in-effect
      setStepIndex(0)
    }
  }, [open])

  const finish = useCallback(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, 'done')
      } catch {
        // 隐私模式忽略
      }
    }
    onComplete?.()
    onClose()
  }, [storageKey, onComplete, onClose])

  const next = useCallback(() => {
    if (isLast) {
      finish()
    } else {
      setStepIndex((i) => i + 1)
    }
  }, [isLast, finish])

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  const jump = useCallback((index: number) => {
    setStepIndex(clamp(index, 0, steps.length - 1))
  }, [steps.length])

  // 键盘左右箭头切步骤
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        next()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        prev()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, next, prev])

  const spotlightX = target.x - SPOTLIGHT_PAD
  const spotlightY = target.y - SPOTLIGHT_PAD
  const spotlightW = target.width + SPOTLIGHT_PAD * 2
  const spotlightH = target.height + SPOTLIGHT_PAD * 2

  const maskUrl = `url(#${maskId})`
  const overlayFill = 'color-mix(in oklab, var(--color-bg) 80%, transparent)'

  const arrowStyle = useMemo(() => {
    const base = 'absolute size-3 rotate-45 bg-surface border'
    switch (cardPos.side) {
      case 'top':
        return cn(base, 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-0 border-l-0')
      case 'bottom':
        return cn(base, 'top-[-6px] left-1/2 -translate-x-1/2 border-b-0 border-r-0')
      case 'left':
        return cn(base, 'right-[-6px] top-1/2 -translate-y-1/2 border-l-0 border-b-0')
      case 'right':
        return cn(base, 'left-[-6px] top-1/2 -translate-y-1/2 border-r-0 border-t-0')
    }
  }, [cardPos.side])

  if (!open || !hasSteps) return null

  return createPortal(
    <div className="fixed inset-0 z-100">
      {/* 遮罩 + 聚光灯 */}
      <svg
        className="pointer-events-auto absolute inset-0 size-full"
        role="presentation"
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <m.rect
              x={spotlightX}
              y={spotlightY}
              width={spotlightW}
              height={spotlightH}
              rx={SPOTLIGHT_RADIUS}
              fill="black"
              initial={reduce ? undefined : { opacity: 0, x: spotlightX + spotlightW / 2, y: spotlightY + spotlightH / 2, width: 0, height: 0 }}
              animate={{ opacity: 1, x: spotlightX, y: spotlightY, width: spotlightW, height: spotlightH }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 }}
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={overlayFill}
          mask={maskUrl}
        />
      </svg>

      {/* 脉冲光环 */}
      {currentStep?.target ? (
        <m.div
          className="pointer-events-none absolute rounded-2xl border-2 border-accent"
          style={{
            left: spotlightX,
            top: spotlightY,
            width: spotlightW,
            height: spotlightH,
          }}
          initial={reduce ? { opacity: 0.8 } : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 }}
        >
          {!reduce && (
            <span className="absolute inset-0 rounded-2xl border border-accent animate-ping opacity-40" />
          )}
        </m.div>
      ) : null}

      {/* 引导卡片 */}
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={stepIndex}
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32, mass: 0.85 }}
          style={{ top: cardPos.top, left: cardPos.left }}
          className={cn(
            'fixed z-[110] w-[min(92vw,360px)] rounded-2xl border border-border bg-surface shadow-lift outline-none',
            className,
          )}
        >
          <div className="relative overflow-hidden rounded-2xl p-5">
            {/* 装饰性背景光晕 */}
            <div
              className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full opacity-30 blur-3xl"
              style={{ backgroundColor: 'var(--color-accent)' }}
            />

            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {currentStep?.icon ? (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    {currentStep.icon}
                  </span>
                ) : null}
                <h3 id={titleId} className="text-base font-semibold text-text">
                  {currentStep?.title}
                </h3>
              </div>
              <IconButton label="关闭引导" size="sm" variant="ghost" onClick={onClose}>
                <IconClose size={16} />
              </IconButton>
            </div>

            <p id={descId} className="relative mt-3 text-sm leading-relaxed text-muted">
              {currentStep?.description}
            </p>

            {/* 进度条 */}
            <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-surface-alt">
              <m.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
              />
            </div>

            {/* 步骤点 */}
            <div className="relative mt-3 flex items-center justify-center gap-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`跳到第 ${index + 1} 步`}
                  onClick={() => jump(index)}
                  className={cn(
                    'h-2 rounded-full transition-all duration-200 ease-snap focus-ring',
                    index === stepIndex ? 'w-6 bg-accent' : 'w-2 bg-text-faint/40 hover:bg-text-faint/70',
                  )}
                />
              ))}
            </div>

            {/* 操作按钮 */}
            <div className="relative mt-5 flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" disabled={stepIndex === 0} onClick={prev} icon={<IconArrowLeft size={16} />}>
                上一步
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={next}
                iconRight={isLast ? undefined : <IconArrowRight size={16} />}
              >
                {isLast ? '完成' : '下一步'}
              </Button>
            </div>
          </div>

          {/* 箭头 */}
          <span className={cn(arrowStyle, 'border-border bg-surface')} />
        </m.div>
      </AnimatePresence>
    </div>,
    document.body,
  )
}
