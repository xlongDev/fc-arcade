/**
 * Gamepad 输入源。
 *
 * Gamepad API 是轮询式的：navigator.getGamepads() 每次返回的是**快照对象**，
 * 不能缓存 Gamepad 实例然后指望它自己更新。所以每帧都要重新取一次数组。
 *
 * connected/disconnected 事件在 Chrome 上要用户先按一下手柄才会触发，
 * Safari 干脆可能不派发。因此除了监听事件，poll 里还做了一次廉价的「在位签名」比对，
 * 发现插拔就重新分配槽位，保证冷插拔也能认出来。
 *
 * 槽位分配：P1 / P2 各占一个 gamepad.index，先到先得；拔掉后腾出槽位给下一个。
 */
import type {
  ButtonMask,
  GamepadInfo,
  GamepadMap,
  InputSource,
  InputState,
  PlayerGamepadMap,
  PlayerIndex,
} from '@/types/input'
import { BUTTON_BIT, NES_BUTTONS } from '@/types/input'
import { clamp } from '@/lib/format'
import { PLAYERS, createInputState } from './mask'

/** 扳机键是模拟量，pressed 在部分驱动上要压到底才为 true，用 value 兜一层 */
const ANALOG_PRESS_THRESHOLD = 0.5
const MIN_DEADZONE = 0.05
const MAX_DEADZONE = 0.95

/**
 * Gamepad.vibrationActuator 至今没进 TypeScript 的 DOM lib（本仓库的 TS 7.0 也没有），
 * 这里按 W3C Gamepad Extensions 手写一份最小结构，避免 any。
 */
interface DualRumbleEffect {
  duration: number
  startDelay?: number
  strongMagnitude?: number
  weakMagnitude?: number
}

interface HapticActuatorLike {
  playEffect: (type: string, params: DualRumbleEffect) => Promise<unknown>
}

export interface RumbleOptions {
  durationMs?: number
  /** 低频马达强度 0~1 */
  strong?: number
  /** 高频马达强度 0~1 */
  weak?: number
}

function getActuator(pad: Gamepad): HapticActuatorLike | null {
  const actuator = (pad as Gamepad & { vibrationActuator?: unknown }).vibrationActuator
  if (typeof actuator !== 'object' || actuator === null) return null
  const candidate = actuator as { playEffect?: unknown }
  return typeof candidate.playEffect === 'function' ? (actuator as HapticActuatorLike) : null
}

/** getGamepads() 本身每次就返回新数组，不要再 spread 一层——这是每帧都跑的路径 */
function listPads(): readonly (Gamepad | null)[] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return []
  try {
    return navigator.getGamepads()
  } catch {
    // 部分浏览器在非安全上下文里会直接抛
    return []
  }
}

/** 把一个手柄的当前状态读成掩码 */
export function readPadMask(pad: Gamepad, map: PlayerGamepadMap): ButtonMask {
  let mask = 0

  for (const button of NES_BUTTONS) {
    const indices = map.buttons[button]
    if (!Array.isArray(indices)) continue
    for (const index of indices) {
      const padButton = pad.buttons[index] as GamepadButton | undefined
      if (!padButton) continue
      if (padButton.pressed || padButton.value >= ANALOG_PRESS_THRESHOLD) {
        mask |= BUTTON_BIT[button]
        break
      }
    }
  }

  const deadzone = clamp(map.deadzone, MIN_DEADZONE, MAX_DEADZONE)

  const horizontal = map.axes.horizontal
  if (horizontal !== null) {
    const value = pad.axes[horizontal] ?? 0
    if (value <= -deadzone) mask |= BUTTON_BIT.left
    else if (value >= deadzone) mask |= BUTTON_BIT.right
  }

  const vertical = map.axes.vertical
  if (vertical !== null) {
    const value = pad.axes[vertical] ?? 0
    // 摇杆 Y 轴向上是负值
    if (value <= -deadzone) mask |= BUTTON_BIT.up
    else if (value >= deadzone) mask |= BUTTON_BIT.down
  }

  return mask
}

export interface GamepadSourceOptions {
  map: GamepadMap
  vibration?: boolean
  onChange?: (pads: GamepadInfo[]) => void
}

export class GamepadSource implements InputSource {
  readonly id = 'gamepad' as const

  #map: GamepadMap
  #vibration: boolean
  #onChange: ((pads: GamepadInfo[]) => void) | undefined
  #masks: [ButtonMask, ButtonMask] = [0, 0]
  /** [P1, P2] 各自占用的 gamepad.index，null 表示空槽 */
  #slots: [number | null, number | null] = [null, null]
  #known: GamepadInfo[] = []
  /** 在位手柄的签名，用来在没有事件的浏览器上发现插拔 */
  #signature = ''
  #attached = false

  constructor(options: GamepadSourceOptions) {
    this.#map = options.map
    this.#vibration = options.vibration ?? false
    this.#onChange = options.onChange
  }

  get attached(): boolean {
    return this.#attached
  }

  get gamepads(): GamepadInfo[] {
    return this.#known
  }

  setMap(map: GamepadMap): void {
    this.#map = map
  }

  setVibration(enabled: boolean): void {
    this.#vibration = enabled
  }

  setOnChange(callback: ((pads: GamepadInfo[]) => void) | undefined): void {
    this.#onChange = callback
  }

  attach(): void {
    if (this.#attached) return
    window.addEventListener('gamepadconnected', this.#onConnectionChange)
    window.addEventListener('gamepaddisconnected', this.#onConnectionChange)
    this.#attached = true
    this.#rescan()
  }

  detach(): void {
    if (!this.#attached) return
    window.removeEventListener('gamepadconnected', this.#onConnectionChange)
    window.removeEventListener('gamepaddisconnected', this.#onConnectionChange)
    this.#attached = false
    this.clear()
  }

  poll(): void {
    const pads = listPads()

    const signature = padSignature(pads)
    if (signature !== this.#signature) this.#rescan(pads)

    for (const player of PLAYERS) {
      const index = this.#slots[player]
      if (index === null) {
        this.#masks[player] = 0
        continue
      }
      const pad = pads[index]
      if (!pad || !pad.connected) {
        this.#masks[player] = 0
        continue
      }
      this.#masks[player] = readPadMask(pad, this.#map[player])
    }
  }

  getState(): InputState {
    return createInputState(this.#masks[0], this.#masks[1])
  }

  clear(): void {
    this.#masks[0] = 0
    this.#masks[1] = 0
  }

  /** 手动把某个手柄指派给某个玩家，供设置界面调整顺序 */
  assign(player: PlayerIndex, gamepadIndex: number | null): void {
    for (const other of PLAYERS) {
      if (other !== player && this.#slots[other] === gamepadIndex) this.#slots[other] = null
    }
    this.#slots[player] = gamepadIndex
    this.#masks[player] = 0
    this.#publish(listPads())
  }

  /** 震动。vibration 关闭、手柄不支持、或该玩家没有手柄时静默跳过。 */
  rumble(player: PlayerIndex, options: RumbleOptions = {}): void {
    if (!this.#vibration) return
    const index = this.#slots[player]
    if (index === null) return
    const pad = listPads()[index]
    if (!pad || !pad.connected) return
    const actuator = getActuator(pad)
    if (!actuator) return

    void actuator
      .playEffect('dual-rumble', {
        duration: options.durationMs ?? 120,
        strongMagnitude: clamp(options.strong ?? 0.6, 0, 1),
        weakMagnitude: clamp(options.weak ?? 0.3, 0, 1),
      })
      .catch(() => {
        // 手柄断开 / 不支持 dual-rumble，震不动就算了，不该影响游戏
      })
  }

  #onConnectionChange = (): void => {
    this.#rescan()
  }

  /** 重新分配槽位：保留仍在位的绑定，把空出来的槽按 index 顺序补给新手柄 */
  #rescan(padsInput?: readonly (Gamepad | null)[]): void {
    const pads = padsInput ?? listPads()
    this.#signature = padSignature(pads)

    for (const player of PLAYERS) {
      const index = this.#slots[player]
      if (index === null) continue
      const pad = pads[index]
      if (!pad || !pad.connected) {
        this.#slots[player] = null
        this.#masks[player] = 0
      }
    }

    for (const pad of pads) {
      if (!pad || !pad.connected) continue
      if (this.#slots[0] === pad.index || this.#slots[1] === pad.index) continue
      const free = PLAYERS.find((player) => this.#slots[player] === null)
      if (free === undefined) break
      this.#slots[free] = pad.index
    }

    this.#publish(pads)
  }

  #publish(pads: readonly (Gamepad | null)[]): void {
    const infos: GamepadInfo[] = []
    for (const pad of pads) {
      if (!pad) continue
      const assignedTo = PLAYERS.find((player) => this.#slots[player] === pad.index) ?? null
      infos.push({
        index: pad.index,
        id: pad.id,
        mapping: pad.mapping,
        assignedTo,
        connected: pad.connected,
      })
    }
    this.#known = infos
    this.#onChange?.(infos)
  }
}

function padSignature(pads: readonly (Gamepad | null)[]): string {
  let signature = ''
  for (const pad of pads) {
    if (!pad || !pad.connected) continue
    signature += `${pad.index}:${pad.id};`
  }
  return signature
}
