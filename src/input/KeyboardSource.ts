/**
 * 键盘输入源。
 *
 * 几个刻意的设计：
 * - 用 event.code（物理键位）而不是 event.key。换输入法、切 Dvorak/AZERTY 布局，
 *   甚至按住 Shift，code 都不变，key 会变。映射表存的也是 code。
 * - 带 Ctrl / Meta / Alt 的组合键整条放行，不然 Cmd+R、Ctrl+F 会被游戏吃掉。
 * - keydown 走「可编辑元素让路」，keyup 不让路：如果玩家按住方向键的同时点进搜索框，
 *   那个 keyup 仍然必须把位清掉，否则按键会永久卡住。
 * - 失焦清空由 InputManager 统一负责（它要一起清触摸源），这里不重复挂监听。
 */
import type {
  ButtonMask,
  InputSource,
  InputState,
  KeyboardMap,
  PlayerIndex,
} from '@/types/input'
import { BUTTON_BIT, NES_BUTTONS } from '@/types/input'
import { PLAYERS, createInputState } from './mask'

interface Binding {
  player: PlayerIndex
  bit: number
}

/** code -> 命中的所有 (玩家, 位)。一个物理键允许同时绑给多个按键 / 多个玩家。 */
type Lookup = Map<string, Binding[]>

function buildLookup(map: KeyboardMap): Lookup {
  const lookup: Lookup = new Map()
  for (const player of PLAYERS) {
    const playerMap = map[player]
    if (!playerMap) continue
    for (const button of NES_BUTTONS) {
      const codes = playerMap[button]
      if (!Array.isArray(codes)) continue
      for (const code of codes) {
        if (typeof code !== 'string' || code.length === 0) continue
        const list = lookup.get(code)
        const binding: Binding = { player, bit: BUTTON_BIT[button] }
        if (list) list.push(binding)
        else lookup.set(code, [binding])
      }
    }
  }
  return lookup
}

/** 焦点在输入框 / 富文本里时整体让路，不能玩家在搜索框打字结果马里奥在跑 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export interface KeyboardSourceOptions {
  map: KeyboardMap
  /** 监听目标，默认 window。测试时可传入自建的 EventTarget。 */
  target?: EventTarget
}

export class KeyboardSource implements InputSource {
  readonly id = 'keyboard' as const

  #map: KeyboardMap
  #lookup: Lookup
  #target: EventTarget
  #masks: [ButtonMask, ButtonMask] = [0, 0]
  #attached = false

  constructor(options: KeyboardSourceOptions) {
    this.#map = options.map
    this.#lookup = buildLookup(options.map)
    this.#target = options.target ?? window
  }

  get attached(): boolean {
    return this.#attached
  }

  get map(): KeyboardMap {
    return this.#map
  }

  setMap(map: KeyboardMap): void {
    this.#map = map
    this.#lookup = buildLookup(map)
    // 改键瞬间旧的位可能永远等不到 keyup 了，直接清空最稳
    this.clear()
  }

  /** 键盘是事件驱动的，不需要轮询 */
  poll(): void {
    // no-op
  }

  getState(): InputState {
    return createInputState(this.#masks[0], this.#masks[1])
  }

  clear(): void {
    this.#masks[0] = 0
    this.#masks[1] = 0
  }

  attach(): void {
    if (this.#attached) return
    // keydown 需要 preventDefault，不能用 passive
    this.#target.addEventListener('keydown', this.#onKeyDown as EventListener)
    this.#target.addEventListener('keyup', this.#onKeyUp as EventListener)
    this.#attached = true
  }

  detach(): void {
    if (!this.#attached) return
    this.#target.removeEventListener('keydown', this.#onKeyDown as EventListener)
    this.#target.removeEventListener('keyup', this.#onKeyUp as EventListener)
    this.#attached = false
    this.clear()
  }

  /** 该 code 是否被当前映射占用，供设置界面做冲突提示 */
  isBound(code: string): boolean {
    return this.#lookup.has(code)
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (isEditableTarget(event.target)) return

    const bindings = this.#lookup.get(event.code)
    if (!bindings) return

    // 方向键 / 空格会滚动页面，Enter 会触发聚焦元素的默认行为，一律拦掉
    event.preventDefault()
    if (event.repeat) return

    for (const binding of bindings) {
      this.#masks[binding.player] |= binding.bit
    }
  }

  #onKeyUp = (event: KeyboardEvent): void => {
    const bindings = this.#lookup.get(event.code)
    if (!bindings) return

    // 不 preventDefault：滚动之类的默认行为都发生在 keydown，
    // 而这里必须无条件放行到清位逻辑（哪怕焦点已经跑到输入框里）
    for (const binding of bindings) {
      this.#masks[binding.player] &= ~binding.bit
    }
  }
}

/** 供设置界面「按任意键改键」用：捕获下一个物理键位。Esc 返回 null 表示取消。 */
export function captureKeyCode(options: { signal?: AbortSignal } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      cleanup()
      resolve(event.code === 'Escape' ? null : event.code)
    }
    const onAbort = (): void => {
      cleanup()
      resolve(null)
    }
    const cleanup = (): void => {
      window.removeEventListener('keydown', onKeyDown, true)
      options.signal?.removeEventListener('abort', onAbort)
    }

    if (options.signal?.aborted) {
      resolve(null)
      return
    }
    window.addEventListener('keydown', onKeyDown, true)
    options.signal?.addEventListener('abort', onAbort)
  })
}
