/**
 * 全局默认值。这是跨模块的锚点：输入系统、设置 store、设置界面都从这里取默认值，
 * 避免互相依赖。任何一条开发线都不要改这个文件的导出签名。
 */
import type { GamepadMap, KeyboardMap, TurboConfig } from '@/types/input'
import type { AppSettings, TouchLayout } from '@/types/ui'

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
    // 玩家 2 默认用数字键盘簇：与 NostalgistAdapter 的 PLAYER2_BINDINGS 单字母
    // 令牌空间（g/h/t/y/i/k/j/l）完全不相交，避免「按某个字母键同时触发两个按键」
    // 的碰撞（例如旧默认里的 KeyI 既被当成玩家 2 的 B，又被 RetroArch 当成
    // input_player2_up 的令牌，导致按下 I 时方向键被连带触发）。
    up: ['Numpad8'],
    down: ['Numpad2'],
    left: ['Numpad4'],
    right: ['Numpad6'],
    a: ['Numpad3'],
    b: ['Numpad1'],
    select: ['Numpad7'],
    start: ['Numpad9'],
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
  aspectRatio: 'original',
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
  /** 未自定义时一律用内置默认（见 DEFAULT_TOUCH_LAYOUT） */
  touchLayout: null,
}

/**
 * 触屏虚拟手柄内置默认布局（归一化坐标，左上角原点）。
 * 默认按竖屏手机优化：D-Pad 与 A/B 放在游戏画面下方的空白区，
 * SELECT/START 贴底居中，避免初始位置盖住游戏画布。
 * 用户拖拽后会写入 settings.touchLayout 覆盖这一份。
 */
export const DEFAULT_TOUCH_LAYOUT: TouchLayout = {
  dpad: { x: 0.15, y: 0.82 },
  a: { x: 0.74, y: 0.78 },
  b: { x: 0.86, y: 0.88 },
  select: { x: 0.40, y: 0.94 },
  start: { x: 0.60, y: 0.94 },
}

/** localStorage key，index.html 的防闪白脚本也依赖这个名字 */
export const SETTINGS_STORAGE_KEY = 'fc-arcade-settings'
