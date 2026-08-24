/**
 * 全局设置 store。
 *
 * 持久化到 localStorage（key = fc-arcade-settings），形状固定为
 * `{ state: { settings }, version }`——index.html 的防闪白脚本和 ThemeProvider
 * 都按这个形状读，不要改。
 *
 * ┌─ 架构不变量（Architectural Invariant，勿删任一方）──────────────────────┐
 * │ themeId / mode 这一份「当前主题状态」同时由两个模块持有并持久化：         │
 * │   · <ThemeProvider> 负责「视图侧写入」——它要做主题过渡动画，写入后会广播  │
 * │     `fc-arcade:theme` 事件；                                         │
 * │   · 本 store 订阅该事件把值回写，否则下一次普通 setSetting 会用旧值覆盖 │
 * │     用户刚选的主题。                                                 │
 * │ ⇒ 两条线必须同时存在且同步：改主题请走 useTheme().setTheme()（不要用     │
 * │   setSetting('themeId'/'mode')），否则会绕过过渡动画并破坏这份契约。    │
 * └──────────────────────────────────────────────────────────────────────┘
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  DEFAULT_GAMEPAD_MAP,
  DEFAULT_KEYBOARD_MAP,
  DEFAULT_SETTINGS,
  DEFAULT_TURBO,
  SETTINGS_STORAGE_KEY,
} from '@/config/defaults'
import type { EmulatorCore } from '@/types/emulator'
import type {
  GamepadMap,
  KeyboardMap,
  NesButton,
  PlayerGamepadMap,
  PlayerKeyboardMap,
  TurboConfig,
} from '@/types/input'
import { NES_BUTTONS } from '@/types/input'
import type { ColorModeSetting, ThemeId } from '@/types/theme'
import { THEME_IDS } from '@/types/theme'
import type { GameSortKey } from '@/types/storage'
import type {
  AppSettings,
  AspectRatio,
  LibraryLayout,
  PadId,
  PadPos,
  ScreenFilter,
  TouchLayout,
} from '@/types/ui'
import { ASPECT_RATIOS, LIBRARY_LAYOUTS } from '@/types/ui'

export { DEFAULT_SETTINGS } from '@/config/defaults'

/** 持久化格式版本。改动 AppSettings 的字段语义时 +1，并在 migrate 里补一段。 */
export const SETTINGS_VERSION = 1

export interface SettingsState {
  settings: AppSettings
  /** 改单个设置项 */
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  /** 一次改多项（浅合并到 settings 顶层） */
  patchSettings: (patch: Partial<AppSettings>) => void
  /** 恢复出厂设置。themeId / mode 保留，避免界面在用户没预期时突然变色 */
  resetSettings: () => void
}

/* ----------------------------- 取值净化工具 ----------------------------- */

const SORT_KEYS: readonly GameSortKey[] = [
  'lastPlayedAt',
  'addedAt',
  'title',
  'year',
  'playCount',
  'totalPlayMs',
]
const SCREEN_FILTERS: readonly ScreenFilter[] = ['none', 'scanline', 'crt', 'lcd']
const CORES: readonly EmulatorCore[] = ['nostalgist']
const MODES: readonly ColorModeSetting[] = ['light', 'dark', 'system']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function stringList(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...fallback]
  const items = value.filter((v): v is string => typeof v === 'string')
  return items.length > 0 ? items : [...fallback]
}

function numberList(value: unknown, fallback: readonly number[]): number[] {
  if (!Array.isArray(value)) return [...fallback]
  const items = value.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return items.length > 0 ? items : [...fallback]
}

function buttonList(value: unknown, fallback: readonly NesButton[]): NesButton[] {
  if (!Array.isArray(value)) return [...fallback]
  return value.filter((v): v is NesButton => (NES_BUTTONS as readonly unknown[]).includes(v))
}

/* --------------------------- 触屏布局净化 --------------------------- */

const PAD_IDS: readonly PadId[] = ['dpad', 'a', 'b', 'select', 'start']

function sanitizePos(value: unknown): PadPos | null {
  if (!isRecord(value)) return null
  const x = num(value.x, NaN, 0, 1)
  const y = num(value.y, NaN, 0, 1)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

function sanitizeTouchLayout(value: unknown, fallback: TouchLayout | null): TouchLayout | null {
  if (value === null) return null
  if (!isRecord(value)) return fallback
  const resolved = {} as TouchLayout
  for (const id of PAD_IDS) {
    const pos = sanitizePos(value[id])
    if (!pos) return fallback
    resolved[id] = pos
  }
  return resolved
}

/* ------------------------- 嵌套结构的逐字段合并 ------------------------- */

function mergeKeyboardPlayer(value: unknown, fallback: PlayerKeyboardMap): PlayerKeyboardMap {
  if (!isRecord(value)) return { ...fallback }
  const merged = {} as PlayerKeyboardMap
  for (const button of NES_BUTTONS) {
    merged[button] = stringList(value[button], fallback[button])
  }
  return merged
}

function mergeKeyboardMap(value: unknown, fallback: KeyboardMap): KeyboardMap {
  const source = isRecord(value) ? value : {}
  return {
    0: mergeKeyboardPlayer(source[0], fallback[0]),
    1: mergeKeyboardPlayer(source[1], fallback[1]),
  }
}

function mergeGamepadPlayer(value: unknown, fallback: PlayerGamepadMap): PlayerGamepadMap {
  if (!isRecord(value)) return cloneGamepadPlayer(fallback)
  const rawButtons = isRecord(value.buttons) ? value.buttons : {}
  const buttons = {} as PlayerGamepadMap['buttons']
  for (const button of NES_BUTTONS) {
    buttons[button] = numberList(rawButtons[button], fallback.buttons[button])
  }
  const rawAxes = isRecord(value.axes) ? value.axes : {}
  return {
    buttons,
    axes: {
      horizontal: axisIndex(rawAxes.horizontal, fallback.axes.horizontal),
      vertical: axisIndex(rawAxes.vertical, fallback.axes.vertical),
    },
    deadzone: num(value.deadzone, fallback.deadzone, 0, 0.95),
  }
}

function axisIndex(value: unknown, fallback: number | null): number | null {
  if (value === null) return null
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  return fallback
}

function mergeGamepadMap(value: unknown, fallback: GamepadMap): GamepadMap {
  const source = isRecord(value) ? value : {}
  return {
    0: mergeGamepadPlayer(source[0], fallback[0]),
    1: mergeGamepadPlayer(source[1], fallback[1]),
  }
}

function mergeTurbo(value: unknown, fallback: TurboConfig): TurboConfig {
  if (!isRecord(value)) return { ...fallback, buttons: [...fallback.buttons] }
  return {
    enabled: bool(value.enabled, fallback.enabled),
    buttons: buttonList(value.buttons, fallback.buttons),
    rateHz: num(value.rateHz, fallback.rateHz, 2, 30),
  }
}

/** buttons 是嵌套对象，浅拷贝会让默认值被后续修改污染，得多复制一层 */
function cloneGamepadPlayer(source: PlayerGamepadMap): PlayerGamepadMap {
  const buttons = {} as PlayerGamepadMap['buttons']
  for (const button of NES_BUTTONS) buttons[button] = [...source.buttons[button]]
  return { buttons, axes: { ...source.axes }, deadzone: source.deadzone }
}

/**
 * 把 localStorage 里的任意值净化成一个完整的 AppSettings。
 *
 * 默认的浅合并对 keyboardMap / gamepadMap / turbo 不够用：老用户存的是旧结构，
 * 浅合并会整块沿用旧对象，新增的按键就永远是 undefined。这里逐字段兜底。
 */
export function mergeSettings(persisted: unknown, base: AppSettings = DEFAULT_SETTINGS): AppSettings {
  if (!isRecord(persisted)) return { ...base }
  return {
    themeId: oneOf<ThemeId>(persisted.themeId, THEME_IDS, base.themeId),
    mode: oneOf<ColorModeSetting>(persisted.mode, MODES, base.mode),
    layout: oneOf<LibraryLayout>(persisted.layout, LIBRARY_LAYOUTS, base.layout),
    sortBy: oneOf<GameSortKey>(persisted.sortBy, SORT_KEYS, base.sortBy),
    sortDir: oneOf<'asc' | 'desc'>(persisted.sortDir, ['asc', 'desc'], base.sortDir),
    reduceMotion: bool(persisted.reduceMotion, base.reduceMotion),

    volume: num(persisted.volume, base.volume, 0, 1),
    muted: bool(persisted.muted, base.muted),

    defaultCore: oneOf<EmulatorCore>(persisted.defaultCore, CORES, base.defaultCore),
    screenFilter: oneOf<ScreenFilter>(persisted.screenFilter, SCREEN_FILTERS, base.screenFilter),
    integerScale: bool(persisted.integerScale, base.integerScale),
    aspectRatio: oneOf<AspectRatio>(persisted.aspectRatio, ASPECT_RATIOS, base.aspectRatio),
    showFps: bool(persisted.showFps, base.showFps),
    autoScreenshotAfterSec: num(persisted.autoScreenshotAfterSec, base.autoScreenshotAfterSec, 0, 600),
    autoSaveIntervalSec: num(persisted.autoSaveIntervalSec, base.autoSaveIntervalSec, 0, 3600),

    autoBackupEnabled: bool(persisted.autoBackupEnabled, base.autoBackupEnabled),
    autoBackupIntervalHrs: num(persisted.autoBackupIntervalHrs, base.autoBackupIntervalHrs, 0, 8760),
    autoBackupOnExit: bool(persisted.autoBackupOnExit, base.autoBackupOnExit),

    keyboardMap: mergeKeyboardMap(persisted.keyboardMap, base.keyboardMap),
    gamepadMap: mergeGamepadMap(persisted.gamepadMap, base.gamepadMap),
    turbo: mergeTurbo(persisted.turbo, base.turbo),
    vibration: bool(persisted.vibration, base.vibration),
    touchOpacity: num(persisted.touchOpacity, base.touchOpacity, 0.2, 1),
    touchScale: num(persisted.touchScale, base.touchScale, 0.7, 1.4),
    touchLayout: sanitizeTouchLayout(persisted.touchLayout, base.touchLayout),
  }
}

/**
 * 版本迁移。
 * v0（早期没有 version 字段的构建）把设置平铺在 state 根部，这里包一层；
 * 字段级的增删一律交给 mergeSettings 兜底，不需要在这里逐版本罗列。
 */
function migrateSettings(persisted: unknown, from: number): unknown {
  if (!isRecord(persisted)) return persisted
  if (from < 1 && !('settings' in persisted)) return { settings: persisted }
  return persisted
}

/* --------------------------------- store -------------------------------- */

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,

      setSetting: (key, value) => {
        set((state) =>
          state.settings[key] === value
            ? state
            : { settings: { ...state.settings, [key]: value } },
        )
      },

      patchSettings: (patch) => {
        set((state) => ({ settings: { ...state.settings, ...patch } }))
      },

      resetSettings: () => {
        set((state) => ({
          settings: {
            ...DEFAULT_SETTINGS,
            themeId: state.settings.themeId,
            mode: state.settings.mode,
          },
        }))
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: SETTINGS_VERSION,
      // 只持久化 settings，动作函数不入库
      partialize: (state) => ({ settings: state.settings }),
      migrate: migrateSettings,
      merge: (persisted, current) => ({
        ...current,
        settings: mergeSettings(
          isRecord(persisted) ? persisted.settings : undefined,
          current.settings,
        ),
      }),
    },
  ),
)

/* ------------------------------ 主题回写同步 ----------------------------- */

interface ThemeEventDetail {
  themeId: ThemeId
  modeSetting: ColorModeSetting
}

if (typeof window !== 'undefined') {
  window.addEventListener('fc-arcade:theme', (event) => {
    const detail = (event as CustomEvent<Partial<ThemeEventDetail>>).detail
    if (!detail) return
    const { settings } = useSettingsStore.getState()
    const themeId = oneOf<ThemeId>(detail.themeId, THEME_IDS, settings.themeId)
    const mode = oneOf<ColorModeSetting>(detail.modeSetting, MODES, settings.mode)
    if (themeId === settings.themeId && mode === settings.mode) return
    useSettingsStore.setState({ settings: { ...settings, themeId, mode } })
  })
}

/* -------------------------------- 便捷选择器 ------------------------------ */

/** 整个 settings 对象。引用稳定，不需要 useShallow。 */
export function useSettings(): AppSettings {
  return useSettingsStore((s) => s.settings)
}

/** 键盘 / 手柄映射的默认值，改键界面「恢复默认」用得到 */
export const DEFAULT_INPUT_MAPS = {
  keyboardMap: DEFAULT_KEYBOARD_MAP,
  gamepadMap: DEFAULT_GAMEPAD_MAP,
  turbo: DEFAULT_TURBO,
} satisfies Pick<AppSettings, 'keyboardMap' | 'gamepadMap' | 'turbo'>
