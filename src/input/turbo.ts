/**
 * 连发（Turbo）。
 *
 * ## 为什么用软件连发而不是内核原生连发键
 *
 * 本项目的跨层契约 `ButtonMask` 只有 8 个位（BUTTON_BIT，a..right），
 * 适配层（NostalgistAdapter）也只遍历这 8 个键下发 buttonDown/buttonUp。
 * 走内核原生连发键就必须改这个全局冻结的契约，代价远大于收益，所以用软件连发（见下方实现）。
 *
 * 所以连发在输入层用「相位脉冲」实现：把持续按住的键按 rateHz 切成通断方波。
 * 附带好处是内核无关 —— NostalgistAdapter 走同一份 InputState，不需要各自再实现一遍。
 *
 * 相位以「该键本次按下的时刻」为起点，保证按下的第一帧一定是通的，手感不会吞第一下。
 */
import type { ButtonMask, InputState, NesButton, PlayerIndex, TurboConfig } from '@/types/input'
import { BUTTON_BIT } from '@/types/input'
import { clamp } from '@/lib/format'
import { PLAYERS, createInputState } from './mask'

const MIN_RATE_HZ = 2
const MAX_RATE_HZ = 30

export class TurboEngine {
  #config: TurboConfig
  /** [P1, P2] 每个连发键本次按下的起始时刻 */
  #pressedAt: readonly [Map<NesButton, number>, Map<NesButton, number>] = [new Map(), new Map()]

  constructor(config: TurboConfig) {
    this.#config = config
  }

  get config(): TurboConfig {
    return this.#config
  }

  setConfig(config: TurboConfig): void {
    this.#config = config
    this.reset()
  }

  reset(): void {
    for (const map of this.#pressedAt) map.clear()
  }

  /** 输入合并后调用。未开启连发时原样返回，不产生额外分配。 */
  apply(state: InputState, now: number): InputState {
    const config = this.#config
    if (!config.enabled || config.buttons.length === 0) {
      this.reset()
      return state
    }

    // rateHz 是「每秒完整通断周期数」，半周期即通或断的持续时长
    const halfPeriodMs = 500 / clamp(config.rateHz, MIN_RATE_HZ, MAX_RATE_HZ)
    const masks: [ButtonMask, ButtonMask] = [0, 0]
    for (const player of PLAYERS) {
      masks[player] = this.#applyPlayer(player, state.players[player], now, halfPeriodMs)
    }
    return createInputState(masks[0], masks[1])
  }

  #applyPlayer(
    player: PlayerIndex,
    mask: ButtonMask,
    now: number,
    halfPeriodMs: number,
  ): ButtonMask {
    const pressedAt = this.#pressedAt[player]
    let result = mask

    for (const button of this.#config.buttons) {
      // buttons 来自 localStorage 持久化的设置，可能含历史遗留的非法键名
      const bit = BUTTON_BIT[button] ?? 0
      if (bit === 0) continue

      if ((mask & bit) === 0) {
        pressedAt.delete(button)
        continue
      }

      let start = pressedAt.get(button)
      if (start === undefined) {
        start = now
        pressedAt.set(button, now)
      }

      // 偶数半周期为通，奇数为断
      if (Math.floor((now - start) / halfPeriodMs) % 2 !== 0) {
        result &= ~bit
      }
    }

    return result
  }
}
