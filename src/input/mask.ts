/**
 * ButtonMask 位运算工具。
 *
 * 三个输入源各自维护一份 [P1, P2] 掩码，InputManager 按位或合并。
 * 位定义在 src/types/input.ts 的 BUTTON_BIT，这里只提供读写糖，不重新定义位。
 */
import type { ButtonMask, InputState, NesButton, PlayerIndex } from '@/types/input'
import { BUTTON_BIT, NES_BUTTONS } from '@/types/input'

/** 遍历玩家时统一用它，避免各处写 [0, 1] 字面量再断言类型 */
export const PLAYERS: readonly PlayerIndex[] = [0, 1]

export function hasButton(mask: ButtonMask, button: NesButton): boolean {
  return (mask & BUTTON_BIT[button]) !== 0
}

export function withButton(mask: ButtonMask, button: NesButton, pressed: boolean): ButtonMask {
  return pressed ? mask | BUTTON_BIT[button] : mask & ~BUTTON_BIT[button]
}

/** 调试 / 设置界面回显用：把掩码摊成按键名 */
export function maskToButtons(mask: ButtonMask): NesButton[] {
  return NES_BUTTONS.filter((button) => hasButton(mask, button))
}

export function createInputState(p1: ButtonMask, p2: ButtonMask): InputState {
  return { players: [p1, p2] }
}

export function isSameInputState(a: InputState, b: InputState): boolean {
  return a.players[0] === b.players[0] && a.players[1] === b.players[1]
}
