/**
 * 全局默认值。这是跨模块的锚点：输入系统、设置 store、设置界面都从这里取默认值，
 * 避免互相依赖。任何一条开发线都不要改这个文件的导出签名。
 */
import type { GamepadMap, KeyboardMap, TurboConfig } from '@/types/input'
import type { AppSettings } from '@/types/ui'

export const DEFAULT_KEYBOARD_MAP: KeyboardMap = {
  0: {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    a: ['KeyK', 'KeyL'],
    b: ['KeyJ', 'Semicolon'],
    select: ['ShiftRight', 'Backspace'],
    start: ['Enter'],
  },
  1: {
    up: ['KeyT'],
    down: ['KeyG'],
    left: ['KeyF'],
    right: ['KeyH'],
    a: ['Numpad2', 'KeyO'],
    b: ['Numpad1', 'KeyI'],
    select: ['Numpad5'],
    start: ['Numpad6'],
  },
}

/** 标准手柄（standard mapping）下的默认按键下标 */
function standardPad(): GamepadMap[0] {
  return {
    buttons: {
      a: [0, 3],
      b: [1, 2],
      select: [8],
      start: [9],
      up: [12],
      down: [13],
      left: [14],
      right: [15],
    },
    axes: { horizontal: 0, vertical: 1 },
    deadzone: 0.35,
  }
}

export const DEFAULT_GAMEPAD_MAP: GamepadMap = {
  0: standardPad(),
  1: standardPad(),
}

export const DEFAULT_TURBO: TurboConfig = {
  enabled: false,
  buttons: ['a', 'b'],
  rateHz: 16,
}

export const DEFAULT_SETTINGS: AppSettings = {
  themeId: 'famicom',
  mode: 'system',
  layout: 'grid',
  sortBy: 'lastPlayedAt',
  sortDir: 'desc',
  reduceMotion: false,

  volume: 0.7,
  muted: false,

  defaultCore: 'nostalgist',
  screenFilter: 'scanline',
  integerScale: false,
  showFps: false,
  autoScreenshotAfterSec: 10,
  autoSaveIntervalSec: 60,

  autoBackupEnabled: false,
  autoBackupIntervalHrs: 24,
  autoBackupOnExit: true,

  keyboardMap: DEFAULT_KEYBOARD_MAP,
  gamepadMap: DEFAULT_GAMEPAD_MAP,
  turbo: DEFAULT_TURBO,
  vibration: true,
  touchOpacity: 0.75,
  touchScale: 1,
}

/** localStorage key，index.html 的防闪白脚本也依赖这个名字 */
export const SETTINGS_STORAGE_KEY = 'fc-arcade-settings'
