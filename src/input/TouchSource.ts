/**
 * 触摸输入源。
 *
 * 它本身不碰 DOM —— 屏幕手柄的手势识别全在 TouchGamepad.tsx 里，
 * 组件只负责调用 setButton()。这样这层保持纯状态，好测，也方便别的 UI
 * （比如手势识别、外部宏）往里写。
 */
import type { ButtonMask, InputSource, InputState, NesButton, PlayerIndex } from '@/types/input'
import { createInputState, withButton } from './mask'

export class TouchSource implements InputSource {
  readonly id = 'touch' as const

  #masks: [ButtonMask, ButtonMask] = [0, 0]

  setButton(player: PlayerIndex, button: NesButton, pressed: boolean): void {
    this.#masks[player] = withButton(this.#masks[player], button, pressed)
  }

  /** 虚拟十字键滑动时整组方向一起换，逐个 setButton 会多出中间态 */
  setMask(player: PlayerIndex, mask: ButtonMask): void {
    this.#masks[player] = mask
  }

  /** 纯状态源，不需要轮询 */
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
    // no-op：没有全局监听器要挂
  }

  detach(): void {
    this.clear()
  }
}
