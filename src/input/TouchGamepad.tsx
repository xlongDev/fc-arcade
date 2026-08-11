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
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NesButton } from '@/types/input'
import { clamp } from '@/lib/format'
import { cn } from '@/lib/cn'

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
  className?: string
}

export function TouchGamepad({
  onButtonChange,
  onClear,
  opacity = 0.75,
  scale = 1,
  vibration = false,
  hideSystemButtons = false,
  className,
}: TouchGamepadProps): ReactNode {
  // 回调可能每次渲染都换引用，用 ref 兜住，避免所有子按钮跟着重建
  const changeRef = useRef(onButtonChange)
  changeRef.current = onButtonChange
  const clearRef = useRef(onClear)
  clearRef.current = onClear

  const emit = useCallback((button: NesButton, pressed: boolean) => {
    changeRef.current(button, pressed)
  }, [])

  useEffect(() => {
    const onHide = (): void => {
      clearRef.current?.()
    }
    window.addEventListener('blur', onHide)
    return () => {
      window.removeEventListener('blur', onHide)
      clearRef.current?.()
    }
  }, [])

  const style = useMemo<CSSProperties>(
    () =>
      ({
        '--pad-scale': String(clamp(scale, 0.7, 1.4)),
        opacity: clamp(opacity, 0.2, 1),
      }) as CSSProperties,
    [scale, opacity],
  )

  return (
    <div
      role="group"
      aria-label="虚拟手柄"
      style={style}
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-30 select-none',
        'flex items-end justify-between gap-2',
        'px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <DPad onChange={emit} vibration={vibration} />

      <div className="flex flex-col items-center gap-2">
        {!hideSystemButtons && (
          <div className="pointer-events-auto flex gap-2">
            <SystemButton button="select" label="SELECT" onChange={emit} vibration={vibration} />
            <SystemButton button="start" label="START" onChange={emit} vibration={vibration} />
          </div>
        )}
      </div>

      <FaceButtons onChange={emit} vibration={vibration} />
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

interface FaceButtonsProps {
  onChange: (button: NesButton, pressed: boolean) => void
  vibration: boolean
}

function FaceButtons({ onChange, vibration }: FaceButtonsProps): ReactNode {
  return (
    // 仿 Famicom 手柄：B 在左下、A 在右上，斜着排
    <div
      className="pointer-events-auto flex items-end gap-3"
      style={{ paddingBottom: 'calc(0.5rem * var(--pad-scale))' }}
    >
      <RoundButton button="b" label="B" onChange={onChange} vibration={vibration} />
      <div style={{ paddingBottom: 'calc(1.75rem * var(--pad-scale))' }}>
        <RoundButton button="a" label="A" onChange={onChange} vibration={vibration} />
      </div>
    </div>
  )
}

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
