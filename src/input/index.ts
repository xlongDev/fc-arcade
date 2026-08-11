/**
 * 输入层对外入口。
 *
 * 上层（播放器页 / 设置页）只从 '@/input' 取东西，不深入子模块。
 * 这一层刻意不 import 任何 store：所有配置（keyboardMap / gamepadMap / turbo /
 * vibration / touchOpacity / touchScale）都由调用方以参数传入，保持可测试。
 */

/* 核心 */
export { createInputManager } from './InputManager'
export type { InputManagerOptions, ManagedInputManager } from './InputManager'

/* 输入源（一般不用直接碰，设置页做手柄检测时会用到 GamepadSource） */
export { KeyboardSource, captureKeyCode } from './KeyboardSource'
export type { KeyboardSourceOptions } from './KeyboardSource'
export { GamepadSource, readPadMask } from './GamepadSource'
export type { GamepadSourceOptions, RumbleOptions } from './GamepadSource'
export { TouchSource } from './TouchSource'

/* 连发 */
export { TurboEngine } from './turbo'

/* 掩码工具 */
export {
  PLAYERS,
  createInputState,
  hasButton,
  isSameInputState,
  maskToButtons,
  withButton,
} from './mask'

/* 改键辅助 */
export { assignKey, findKeyConflicts, unassignKey } from './conflicts'

/* React */
export { useGamepads, useInput } from './useInput'
export type { UseInputOptions, UseInputResult } from './useInput'
export { TouchGamepad, directionsFromOffset } from './TouchGamepad'
export type { TouchGamepadProps } from './TouchGamepad'

/* 契约类型转出，省得上层再去 '@/types/input' 取一遍 */
export type {
  ButtonMask,
  GamepadInfo,
  GamepadMap,
  InputManager,
  InputSource,
  InputState,
  KeyConflict,
  KeyboardMap,
  NesButton,
  PlayerGamepadMap,
  PlayerIndex,
  PlayerKeyboardMap,
  TurboConfig,
} from '@/types/input'
export { BUTTON_BIT, BUTTON_LABEL, EMPTY_INPUT_STATE, NES_BUTTONS } from '@/types/input'
