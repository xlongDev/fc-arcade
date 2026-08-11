/**
 * 输入系统契约。
 * 三种输入源（键盘 / Gamepad / 触摸虚拟手柄）各自产出 ButtonMask，
 * 由 InputManager 按位或合并成 InputState，每帧注入模拟器。
 */
import type { Unsubscribe } from './common'

export type NesButton = 'a' | 'b' | 'select' | 'start' | 'up' | 'down' | 'left' | 'right'

export const NES_BUTTONS: readonly NesButton[] = [
  'a',
  'b',
  'select',
  'start',
  'up',
  'down',
  'left',
  'right',
] as const

/** 位标志。顺序与 jsnes 的 BUTTON_* 常量保持一致，适配层负责映射。 */
export const BUTTON_BIT: Readonly<Record<NesButton, number>> = {
  a: 1 << 0,
  b: 1 << 1,
  select: 1 << 2,
  start: 1 << 3,
  up: 1 << 4,
  down: 1 << 5,
  left: 1 << 6,
  right: 1 << 7,
}

export const BUTTON_LABEL: Readonly<Record<NesButton, string>> = {
  a: 'A',
  b: 'B',
  select: 'Select',
  start: 'Start',
  up: '上',
  down: '下',
  left: '左',
  right: '右',
}

export type PlayerIndex = 0 | 1

/** 单个玩家的按键位掩码 */
export type ButtonMask = number

/** 一帧的完整输入快照 */
export interface InputState {
  /** [玩家1, 玩家2] */
  players: readonly [ButtonMask, ButtonMask]
}

export const EMPTY_INPUT_STATE: InputState = { players: [0, 0] }

/* ------------------------------- 键盘映射 ------------------------------- */

/** 用 KeyboardEvent.code（与布局无关），一个按键可绑定多个物理键 */
export type PlayerKeyboardMap = Record<NesButton, string[]>

export type KeyboardMap = Record<PlayerIndex, PlayerKeyboardMap>

/* ------------------------------ 手柄映射 ------------------------------- */

export interface PlayerGamepadMap {
  /** NES 按键 → Gamepad.buttons 下标（可多个） */
  buttons: Record<NesButton, number[]>
  /** 摇杆映射，axisIndex + 方向；为 null 表示只用十字键 */
  axes: {
    horizontal: number | null
    vertical: number | null
  }
  /** 摇杆死区，0~1 */
  deadzone: number
}

export type GamepadMap = Record<PlayerIndex, PlayerGamepadMap>

export interface GamepadInfo {
  index: number
  id: string
  mapping: string
  assignedTo: PlayerIndex | null
  connected: boolean
}

/* -------------------------------- 连发 --------------------------------- */

export interface TurboConfig {
  enabled: boolean
  /** 参与连发的按键 */
  buttons: NesButton[]
  /** 每秒触发次数，2~30 */
  rateHz: number
}

/* ------------------------------ 输入源接口 ------------------------------ */

export interface InputSource {
  readonly id: 'keyboard' | 'gamepad' | 'touch'
  /** 每帧调用一次，用于需要轮询的源（Gamepad） */
  poll(now: number): void
  /** 返回当前该源产生的两个玩家的掩码 */
  getState(): InputState
  /** 清空所有按下状态（失焦、暂停时调用） */
  clear(): void
  attach(): void
  detach(): void
}

export interface InputManager {
  readonly sources: readonly InputSource[]
  /** 每帧调用：轮询所有源并按位或合并 */
  update(now: number): InputState
  getState(): InputState
  clearAll(): void
  setKeyboardMap(map: KeyboardMap): void
  setGamepadMap(map: GamepadMap): void
  setTurbo(config: TurboConfig): void
  /** 虚拟手柄按下/抬起，由 React 组件调用 */
  setTouchButton(player: PlayerIndex, button: NesButton, pressed: boolean): void
  clearTouch(): void
  onGamepadChange(cb: (pads: GamepadInfo[]) => void): Unsubscribe
  dispose(): void
}

/* ------------------------------ 改键辅助 ------------------------------- */

export interface KeyConflict {
  code: string
  /** 冲突涉及的 [玩家, 按键] 组合 */
  owners: Array<{ player: PlayerIndex; button: NesButton }>
}
