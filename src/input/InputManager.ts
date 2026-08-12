/**
 * 三源输入汇聚。
 *
 * 键盘 / Gamepad / 触摸各自维护一份 [P1, P2] 掩码，这里每帧按位或合并成一个 InputState，
 * 再过一遍连发引擎，最后交给播放器喂给 EmulatorAdapter.setInput()。
 * 「任一源按下即为按下」，所以键盘和手柄可以随时无缝接管，不需要切换「当前输入设备」。
 *
 * 玩家编号在整条链路上都是 PlayerIndex(0 | 1)。转成内核的 ControllerId(1 | 2)
 * 是适配层的事，由 NostalgistAdapter 把 ButtonMask 映射成 RetroArch 的按键，输入层不参与。
 *
 * 失焦清空由这里统一处理：blur / visibilitychange / pagehide 一律 clearAll()。
 * 少了这一步就会出现「Alt+Tab 切走再切回来，角色一直往右跑」的经典 bug ——
 * 因为切走时的 keyup 根本没派发给页面。
 */
import type {
  GamepadInfo,
  GamepadMap,
  InputManager,
  InputSource,
  InputState,
  KeyboardMap,
  NesButton,
  PlayerIndex,
  TurboConfig,
} from '@/types/input'
import { EMPTY_INPUT_STATE } from '@/types/input'
import type { Unsubscribe } from '@/types/common'
import { Emitter } from '@/lib/emitter'
import { DEFAULT_GAMEPAD_MAP, DEFAULT_KEYBOARD_MAP, DEFAULT_TURBO } from '@/config/defaults'
import { GamepadSource, type RumbleOptions } from './GamepadSource'
import { KeyboardSource } from './KeyboardSource'
import { TouchSource } from './TouchSource'
import { TurboEngine } from './turbo'
import { createInputState } from './mask'

export interface InputManagerOptions {
  keyboardMap?: KeyboardMap
  gamepadMap?: GamepadMap
  turbo?: TurboConfig
  /** 手柄震动总开关，对应 AppSettings.vibration */
  vibration?: boolean
  /** 构造时立即挂载监听器，默认 true。React 里建议传 false，由 effect 控制生命周期。 */
  autoAttach?: boolean
  /** 键盘监听目标，默认 window */
  keyboardTarget?: EventTarget
}

/**
 * 在契约 InputManager 之上补了挂载生命周期。
 * 契约本身只有 dispose()，但 React 组件卸载后可能重新挂载，
 * 需要一个「摘掉监听器但对象还能用」的中间态。
 */
export interface ManagedInputManager extends InputManager {
  readonly attached: boolean
  readonly disposed: boolean
  attach(): void
  detach(): void
  setVibration(enabled: boolean): void
  /** 手动指派手柄给玩家；传 null 解绑 */
  assignGamepad(player: PlayerIndex, gamepadIndex: number | null): void
  getGamepads(): GamepadInfo[]
  rumble(player: PlayerIndex, options?: RumbleOptions): void
  setTouchMask(player: PlayerIndex, mask: number): void
}

type ManagerEvents = { gamepadchange: GamepadInfo[] }

class BrowserInputManager implements ManagedInputManager {
  readonly #keyboard: KeyboardSource
  readonly #gamepad: GamepadSource
  readonly #touch: TouchSource
  readonly #sources: readonly InputSource[]
  readonly #turbo: TurboEngine
  readonly #emitter = new Emitter<ManagerEvents>()

  #state: InputState = EMPTY_INPUT_STATE
  #attached = false
  #disposed = false

  constructor(options: InputManagerOptions = {}) {
    this.#keyboard = new KeyboardSource({
      map: options.keyboardMap ?? DEFAULT_KEYBOARD_MAP,
      target: options.keyboardTarget ?? window,
    })
    this.#gamepad = new GamepadSource({
      map: options.gamepadMap ?? DEFAULT_GAMEPAD_MAP,
      vibration: options.vibration ?? false,
      onChange: (pads) => {
        this.#emitter.emit('gamepadchange', pads)
      },
    })
    this.#touch = new TouchSource()
    this.#sources = [this.#keyboard, this.#gamepad, this.#touch]
    this.#turbo = new TurboEngine(options.turbo ?? DEFAULT_TURBO)

    if (options.autoAttach !== false) this.attach()
  }

  get sources(): readonly InputSource[] {
    return this.#sources
  }

  get attached(): boolean {
    return this.#attached
  }

  get disposed(): boolean {
    return this.#disposed
  }

  attach(): void {
    if (this.#attached || this.#disposed) return
    for (const source of this.#sources) source.attach()
    window.addEventListener('blur', this.#onFocusLost)
    window.addEventListener('pagehide', this.#onFocusLost)
    document.addEventListener('visibilitychange', this.#onVisibilityChange)
    this.#attached = true
  }

  detach(): void {
    if (!this.#attached) return
    for (const source of this.#sources) source.detach()
    window.removeEventListener('blur', this.#onFocusLost)
    window.removeEventListener('pagehide', this.#onFocusLost)
    document.removeEventListener('visibilitychange', this.#onVisibilityChange)
    this.#attached = false
    this.clearAll()
  }

  /** 每帧调用一次。now 用 performance.now()，连发相位依赖它。 */
  update(now: number): InputState {
    if (this.#disposed) return EMPTY_INPUT_STATE

    for (const source of this.#sources) source.poll(now)

    let p1 = 0
    let p2 = 0
    for (const source of this.#sources) {
      const state = source.getState()
      p1 |= state.players[0]
      p2 |= state.players[1]
    }

    this.#state = this.#turbo.apply(createInputState(p1, p2), now)
    return this.#state
  }

  /** 返回上一次 update() 的结果，不重新采样 */
  getState(): InputState {
    return this.#state
  }

  clearAll(): void {
    for (const source of this.#sources) source.clear()
    this.#turbo.reset()
    this.#state = EMPTY_INPUT_STATE
  }

  setKeyboardMap(map: KeyboardMap): void {
    this.#keyboard.setMap(map)
  }

  setGamepadMap(map: GamepadMap): void {
    this.#gamepad.setMap(map)
  }

  setTurbo(config: TurboConfig): void {
    this.#turbo.setConfig(config)
  }

  setVibration(enabled: boolean): void {
    this.#gamepad.setVibration(enabled)
  }

  setTouchButton(player: PlayerIndex, button: NesButton, pressed: boolean): void {
    this.#touch.setButton(player, button, pressed)
  }

  setTouchMask(player: PlayerIndex, mask: number): void {
    this.#touch.setMask(player, mask)
  }

  clearTouch(): void {
    this.#touch.clear()
  }

  assignGamepad(player: PlayerIndex, gamepadIndex: number | null): void {
    this.#gamepad.assign(player, gamepadIndex)
  }

  getGamepads(): GamepadInfo[] {
    return this.#gamepad.gamepads
  }

  rumble(player: PlayerIndex, options?: RumbleOptions): void {
    this.#gamepad.rumble(player, options)
  }

  onGamepadChange(callback: (pads: GamepadInfo[]) => void): Unsubscribe {
    return this.#emitter.on('gamepadchange', callback)
  }

  dispose(): void {
    if (this.#disposed) return
    this.detach()
    this.#emitter.clear()
    this.#disposed = true
  }

  #onFocusLost = (): void => {
    this.clearAll()
  }

  #onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.clearAll()
  }
}

export function createInputManager(options: InputManagerOptions = {}): ManagedInputManager {
  return new BrowserInputManager(options)
}
