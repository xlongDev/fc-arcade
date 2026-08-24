/**
 * 移动端虚拟手柄。
 *
 * 用 Pointer Events 而不是 Touch Events：一套代码同时吃触摸、手写笔和鼠标，
 * 而且 setPointerCapture 能保证手指滑出按钮范围后 pointerup 仍然回到原元素 ——
 * 这是「按键卡住」在触摸端的主要成因。
 *
 * 十字键做的是**方位角判定**而不是 3×3 命中区：手指按住不抬，从上滑到左上，
 * 方向会连续跟着变。方向盘扇区宽度不均等，正方向 60°、斜方向 30°，
 * 这样斜向要刻意去够才出得来，不会一按上就误触左上（NES 里斜向误触很致命）。
 *
 * 所有尺寸走 --pad-scale 变量（对应 AppSettings.touchScale），
 * 颜色只用 token（bg-glass / text-text / bg-accent…），换主题时才能跟着变。
 *
 * 布局可自定义：每个部件（DPad / A / B / SELECT / START）在「编辑模式」下可拖拽，
 * 落点以归一化坐标（0~1，相对可拖拽区域左上角）存入 AppSettings.touchLayout；
 * 不自定义时回退到 DEFAULT_TOUCH_LAYOUT。非编辑模式行为完全不变。
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import type { NesButton } from '@/types/input'
import type { PadId, PadPos, TouchLayout } from '@/types/ui'
import { DEFAULT_TOUCH_LAYOUT } from '@/config/defaults'
import { usePrefersReducedMotion } from '@/features/common/hooks/useMediaQuery'
import { clamp } from '@/lib/format'
import { cn } from '@/lib/cn'
import { IconClose, IconDrag } from '@/components/icons'

/** 12 个 30° 扇区。索引 0 从「右」开始顺时针（屏幕坐标 y 向下）。 */
const SECTOR_DIRECTIONS: readonly (readonly NesButton[])[] = [
  ['right'],
  ['right'],
  ['down', 'right'],
  ['down'],
  ['down'],
  ['down', 'left'],
  ['left'],
  ['left'],
  ['up', 'left'],
  ['up'],
  ['up'],
  ['up', 'right'],
]

const DIRECTIONS: readonly NesButton[] = ['up', 'down', 'left', 'right']

/** 圆心附近的静区，占半径比例。太小会导致轻触就出方向。 */
const DPAD_DEADZONE_RATIO = 0.24

/** 触摸反馈的震动时长（毫秒），短到只有「咔」一下 */
const HAPTIC_MS = 8

/** 拖拽时部件中心离可拖拽区域边缘的最小留白（px），避免拖出屏幕外 */
const DRAG_MARGIN = 12

function vibrate(enabled: boolean, ms: number): void {
  if (!enabled || typeof navigator === 'undefined') return
  const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }
  if (typeof nav.vibrate !== 'function') return
  try {
    nav.vibrate(ms)
  } catch {
    // Safari 不支持，忽略
  }
}

/** 由指针相对十字键中心的偏移算出当前方向组合 */
export function directionsFromOffset(dx: number, dy: number, radius: number): readonly NesButton[] {
  const distance = Math.hypot(dx, dy)
  if (radius <= 0 || distance < radius * DPAD_DEADZONE_RATIO) return []

  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI
  // +30 让「右」的 60° 正区间落在扇区 0、1 上；再归一化到 [0, 360) 保证非负
  const normalized = (((degrees + 30) % 360) + 360) % 360
  return SECTOR_DIRECTIONS[Math.floor(normalized / 30)] ?? []
}

function sameDirections(a: readonly NesButton[], b: readonly NesButton[]): boolean {
  if (a.length !== b.length) return false
  return a.every((item) => b.includes(item))
}

export interface TouchGamepadProps {
  /** 按键状态变化回调。接到后转给 InputManager.setTouchButton。 */
  onButtonChange: (button: NesButton, pressed: boolean) => void
  /** 组件卸载 / 失焦时清空，防止残留按下态 */
  onClear?: () => void
  /** 0.2 ~ 1，对应 AppSettings.touchOpacity */
  opacity?: number
  /** 0.7 ~ 1.4，对应 AppSettings.touchScale */
  scale?: number
  /** 对应 AppSettings.vibration，触摸时给一下振动反馈 */
  vibration?: boolean
  /** 隐藏 Select / Start */
  hideSystemButtons?: boolean
  /** 为底部固定控制栏预留的额外下偏移量（CSS 长度），避免虚拟手柄被控制栏遮挡 */
  controlBarOffset?: string
  /** 编辑模式：开启后各部件可拖拽，且暂停实际按键 */
  editMode?: boolean
  /** 自定义布局（归一化坐标）；null / 缺省时使用内置默认 */
  layout?: TouchLayout | null
  /** 拖拽落点提交（归一化坐标） */
  onLayoutChange?: (id: PadId, pos: PadPos) => void
  className?: string
}

export function TouchGamepad({
  onButtonChange,
  onClear,
  opacity = 0.75,
  scale = 1,
  vibration = false,
  hideSystemButtons = false,
  controlBarOffset = '0px',
  editMode = false,
  layout = null,
  onLayoutChange,
  className,
}: TouchGamepadProps): ReactNode {
  // 直接把 onButtonChange / onClear 透传给子控件；window 失焦时清空按键状态。
  useEffect(() => {
    const onHide = (): void => {
      onClear?.()
    }
    window.addEventListener('blur', onHide)
    return () => {
      window.removeEventListener('blur', onHide)
      onClear?.()
    }
  }, [onClear])

  const style = useMemo<CSSProperties>(
    () =>
      ({
        '--pad-scale': String(clamp(scale, 0.7, 1.4)),
        opacity: clamp(opacity, 0.2, 1),
      }) as CSSProperties,
    [scale, opacity],
  )

  // 可拖拽区域（根容器）的尺寸，用来把归一化坐标换算成 px，并在拖拽时夹在边界内。
  // 用 useLayoutEffect 在首帧前量一次避免初始闪烁，ResizeObserver 跟进后续变化。
  const rootRef = useRef<HTMLDivElement>(null)
  const [rootSize, setRootSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setRootSize({ w: rect.width, h: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layoutResolved = layout ?? DEFAULT_TOUCH_LAYOUT
  const ORDER: readonly PadId[] = ['dpad', 'a', 'b', 'select', 'start']
  const visible = hideSystemButtons
    ? ORDER.filter((id) => id !== 'select' && id !== 'start')
    : ORDER

  // 进入编辑模式时弹一次引导提示，说明可以拖动重排、完成即保存；
  // 几秒后自动消失，也可手动关闭。非编辑模式立即隐藏。
  const reduceMotion = usePrefersReducedMotion()
  const [showHint, setShowHint] = useState(false)
  useEffect(() => {
    if (!editMode) {
      // 与 editMode 外部条件同步：退出编辑模式立即隐藏引导，属于 effect 与交互状态同步。
      // eslint-disable-next-line react/set-state-in-effect
      setShowHint(false)
      return
    }
    setShowHint(true)
    const timer = window.setTimeout(() => setShowHint(false), 4500)
    return () => window.clearTimeout(timer)
  }, [editMode])

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="虚拟手柄"
      style={{
        ...style,
        position: 'absolute',
        inset: 0,
        bottom: controlBarOffset,
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      className={cn('pointer-events-none z-30 select-none', className)}
    >
      {visible.map((id) => (
        <DraggableCluster
          key={id}
          id={id}
          pos={layoutResolved[id]}
          rootSize={rootSize}
          editMode={editMode}
          onCommit={onLayoutChange}
        >
          {renderPad(id, onButtonChange, vibration)}
        </DraggableCluster>
      ))}

      <AnimatePresence>
        {editMode && showHint ? (
          <m.div
            key="layout-edit-hint"
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
            className="pointer-events-none absolute inset-x-0 top-14 z-40 flex justify-center px-4"
          >
            <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-text shadow-lg">
              <IconDrag size={14} className="shrink-0 text-text-muted" />
              <span>拖动按钮调整位置，完成后点「完成布局编辑」保存</span>
              <button
                type="button"
                aria-label="关闭提示"
                onClick={() => setShowHint(false)}
                className="pointer-events-auto ml-1 rounded-full p-0.5 text-text-muted transition-colors hover:text-text"
              >
                <IconClose size={13} />
              </button>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/** 按部件标识渲染对应的手柄控件 */
function renderPad(
  id: PadId,
  onChange: (button: NesButton, pressed: boolean) => void,
  vibration: boolean,
): ReactNode {
  switch (id) {
    case 'dpad':
      return <DPad onChange={onChange} vibration={vibration} />
    case 'a':
      return <RoundButton button="a" label="A" onChange={onChange} vibration={vibration} />
    case 'b':
      return <RoundButton button="b" label="B" onChange={onChange} vibration={vibration} />
    case 'select':
      return <SystemButton button="select" label="SELECT" onChange={onChange} vibration={vibration} />
    case 'start':
      return <SystemButton button="start" label="START" onChange={onChange} vibration={vibration} />
  }
}

/* --------------------------- 可拖拽容器 ----------------------------- */

interface DraggableClusterProps {
  id: PadId
  /** 归一化坐标（0~1） */
  pos: PadPos
  /** 根容器当前尺寸（px），用于 px ↔ 归一化换算与边界夹取 */
  rootSize: { w: number; h: number }
  /** 是否处于编辑模式 */
  editMode: boolean
  /** 拖拽结束提交归一化坐标 */
  onCommit?: (id: PadId, pos: PadPos) => void
  children: ReactNode
}

function DraggableCluster({
  id,
  pos,
  rootSize,
  editMode,
  onCommit,
  children,
}: DraggableClusterProps): ReactNode {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const grab = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })

  // 静止时由归一化坐标换算成 px；拖拽中直接用 px，避免每帧被 pos 拉回。
  const clampPx = useCallback(
    (x: number, y: number) => ({
      x: clamp(x, DRAG_MARGIN, Math.max(DRAG_MARGIN, rootSize.w - DRAG_MARGIN)),
      y: clamp(y, DRAG_MARGIN, Math.max(DRAG_MARGIN, rootSize.h - DRAG_MARGIN)),
    }),
    [rootSize.w, rootSize.h],
  )
  // 静止中心：归一化坐标 × 根尺寸。内联计算，避免把「每帧新建的对象」放进 hook 依赖。
  const current = drag ?? { x: pos.x * rootSize.w, y: pos.y * rootSize.h }

  const handleDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!editMode) return
      event.preventDefault()
      event.stopPropagation()
      const center = drag ?? { x: pos.x * rootSize.w, y: pos.y * rootSize.h }
      grab.current = { dx: event.clientX - center.x, dy: event.clientY - center.y }
      event.currentTarget.setPointerCapture(event.pointerId)
      setDrag(center)
    },
    [editMode, drag, pos, rootSize.w, rootSize.h],
  )

  const handleMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag) return
      setDrag(clampPx(event.clientX - grab.current.dx, event.clientY - grab.current.dy))
    },
    [drag, clampPx],
  )

  const handleUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      const clamped = clampPx(drag.x, drag.y)
      onCommit?.(id, {
        x: clamp(clamped.x / rootSize.w, 0, 1),
        y: clamp(clamped.y / rootSize.h, 0, 1),
      })
      setDrag(null)
    },
    [drag, clampPx, rootSize.w, rootSize.h, id, onCommit],
  )

  return (
    <div
      role={editMode ? 'button' : undefined}
      aria-label={id}
      className={cn(
        'absolute z-10',
        editMode ? 'pointer-events-auto cursor-grab touch-none active:cursor-grabbing' : 'pointer-events-auto',
      )}
      style={{
        left: current.x,
        top: current.y,
        transform: 'translate(-50%, -50%)',
      }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {/* 编辑模式下对内层内容屏蔽指针事件（pointer-events-none），
          这样 pointerdown 会穿透到外层容器、只触发拖拽，而不会先命中按钮、
          误触发 A/B/SELECT/START 按下。同时套一圈高亮环提示「可拖拽」。 */}
      <div className={cn(editMode && 'pointer-events-none rounded-full ring-2 ring-accent/70')}>
        {children}
      </div>
    </div>
  )
}

/* ------------------------------- 十字键 -------------------------------- */

interface DPadProps {
  onChange: (button: NesButton, pressed: boolean) => void
  vibration: boolean
}

function DPad({ onChange, vibration }: DPadProps): ReactNode {
  const [active, setActive] = useState<readonly NesButton[]>([])
  const activeRef = useRef<readonly NesButton[]>([])
  const pointerRef = useRef<number | null>(null)

  const applyDirections = useCallback(
    (next: readonly NesButton[]) => {
      const prev = activeRef.current
      if (sameDirections(prev, next)) return
      for (const direction of DIRECTIONS) {
        const was = prev.includes(direction)
        const now = next.includes(direction)
        if (was !== now) onChange(direction, now)
      }
      activeRef.current = next
      setActive(next)
      if (next.length > prev.length) vibrate(vibration, HAPTIC_MS)
    },
    [onChange, vibration],
  )

  const track = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      applyDirections(directionsFromOffset(dx, dy, Math.min(rect.width, rect.height) / 2))
    },
    [applyDirections],
  )

  const handleDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerRef.current !== null) return
      // 阻止默认能挡掉焦点转移和 iOS 的长按放大镜，pointer capture 不受影响
      event.preventDefault()
      pointerRef.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      track(event)
    },
    [track],
  )

  const handleMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerRef.current !== event.pointerId) return
      track(event)
    },
    [track],
  )

  const handleUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerRef.current !== event.pointerId) return
      pointerRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      applyDirections([])
    },
    [applyDirections],
  )

  useEffect(
    () => () => {
      for (const direction of activeRef.current) onChange(direction, false)
    },
    [onChange],
  )

  return (
    <div
      className="pointer-events-auto relative touch-none"
      style={{ width: 'calc(10.5rem * var(--pad-scale))', height: 'calc(10.5rem * var(--pad-scale))' }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={handleUp}
      onContextMenu={(event) => {
        event.preventDefault()
      }}
      role="group"
      aria-label="方向键"
    >
      {/* 十字底座：横竖两条 glass 长条拼出来 */}
      <div className="glass absolute inset-x-0 top-1/3 bottom-1/3 rounded-md" />
      <div className="glass absolute inset-y-0 left-1/3 right-1/3 rounded-md" />

      {DIRECTIONS.map((direction) => (
        <DPadArm key={direction} direction={direction} active={active.includes(direction)} />
      ))}

      {/* 中心圆点，纯装饰，给手指一个视觉锚点 */}
      <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text/25" />
    </div>
  )
}

const ARM_CLASS: Readonly<Record<string, string>> = {
  up: 'inset-x-1/3 top-0 h-1/3',
  down: 'inset-x-1/3 bottom-0 h-1/3',
  left: 'inset-y-1/3 left-0 w-1/3',
  right: 'inset-y-1/3 right-0 w-1/3',
}

const ARM_GLYPH: Readonly<Record<string, string>> = {
  up: '▲',
  down: '▼',
  left: '◀',
  right: '▶',
}

function DPadArm({ direction, active }: { direction: NesButton; active: boolean }): ReactNode {
  return (
    <div
      aria-hidden
      className={cn(
        'absolute flex items-center justify-center rounded-md transition-colors duration-75',
        ARM_CLASS[direction],
        active ? 'bg-accent text-on-accent' : 'text-text/60',
      )}
    >
      <span
        className="leading-none"
        style={{ fontSize: 'calc(0.85rem * var(--pad-scale))' }}
      >
        {ARM_GLYPH[direction]}
      </span>
    </div>
  )
}

/* ------------------------------- A / B --------------------------------- */

interface PadButtonProps {
  button: NesButton
  label: string
  onChange: (button: NesButton, pressed: boolean) => void
  vibration: boolean
}

/** 按下 / 抬起的公共逻辑：独立 pointerId，允许 A、B 双指同按 */
function usePressHandlers({ button, onChange, vibration }: PadButtonProps): {
  pressed: boolean
  handlers: {
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void
    onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => void
    onContextMenu: (event: { preventDefault: () => void }) => void
  }
} {
  const [pressed, setPressed] = useState(false)
  const pointerRef = useRef<number | null>(null)

  const release = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (pointerRef.current !== event.pointerId) return
      pointerRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      setPressed(false)
      onChange(button, false)
    },
    [button, onChange],
  )

  const press = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (pointerRef.current !== null) return
      event.preventDefault()
      pointerRef.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      setPressed(true)
      onChange(button, true)
      vibrate(vibration, HAPTIC_MS)
    },
    [button, onChange, vibration],
  )

  useEffect(
    () => () => {
      if (pointerRef.current !== null) onChange(button, false)
    },
    [button, onChange],
  )

  return {
    pressed,
    handlers: {
      onPointerDown: press,
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onContextMenu: (event) => {
        event.preventDefault()
      },
    },
  }
}

function RoundButton(props: PadButtonProps): ReactNode {
  const { pressed, handlers } = usePressHandlers(props)

  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={pressed}
      className={cn(
        'tap-target focus-ring flex touch-none items-center justify-center rounded-full',
        'font-pixel transition-colors duration-75',
        pressed ? 'bg-accent text-on-accent' : 'glass text-text',
      )}
      style={{
        width: 'calc(4.25rem * var(--pad-scale))',
        height: 'calc(4.25rem * var(--pad-scale))',
        fontSize: 'calc(1rem * var(--pad-scale))',
      }}
      {...handlers}
    >
      {props.label}
    </button>
  )
}

function SystemButton(props: PadButtonProps): ReactNode {
  const { pressed, handlers } = usePressHandlers(props)

  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={pressed}
      className={cn(
        'focus-ring flex touch-none items-center justify-center rounded-full px-3',
        'font-pixel tracking-wider transition-colors duration-75',
        pressed ? 'bg-accent text-on-accent' : 'glass text-text-muted',
      )}
      style={{
        height: 'calc(1.9rem * var(--pad-scale))',
        fontSize: 'calc(0.5rem * var(--pad-scale))',
      }}
      {...handlers}
    >
      {props.label}
    </button>
  )
}
