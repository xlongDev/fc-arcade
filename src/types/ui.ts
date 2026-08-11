/**
 * UI 状态与全局设置契约。
 * settings 走 localStorage + Zustand persist；重量级数据走 IndexedDB。
 */
import type { EmulatorCore } from './emulator'
import type { GameCategory } from './game'
import type { GamepadMap, KeyboardMap, TurboConfig } from './input'
import type { GameSortKey } from './storage'
import type { ColorModeSetting, ThemeId } from './theme'

export type LibraryLayout = 'grid' | 'compact' | 'list' | 'wall' | 'shelf'

export const LIBRARY_LAYOUTS: readonly LibraryLayout[] = [
  'grid',
  'compact',
  'list',
  'wall',
  'shelf',
] as const

export const LAYOUT_LABEL: Readonly<Record<LibraryLayout, string>> = {
  grid: '大卡片',
  compact: '紧凑网格',
  list: '列表',
  wall: '封面墙',
  shelf: '卡带架',
}

export const SORT_LABEL: Readonly<Record<GameSortKey, string>> = {
  lastPlayedAt: '最近游玩',
  addedAt: '添加时间',
  title: '标题',
  year: '发行年份',
  playCount: '游玩次数',
  totalPlayMs: '游玩时长',
}

export interface LibraryFilter {
  keyword: string
  categories: GameCategory[]
  yearRange: [number, number] | null
  favoriteOnly: boolean
}

export const EMPTY_FILTER: LibraryFilter = {
  keyword: '',
  categories: [],
  yearRange: null,
  favoriteOnly: false,
}

export type ScreenFilter = 'none' | 'scanline' | 'crt' | 'lcd'

export interface AppSettings {
  /* 外观 */
  themeId: ThemeId
  mode: ColorModeSetting
  layout: LibraryLayout
  sortBy: GameSortKey
  sortDir: 'asc' | 'desc'
  reduceMotion: boolean

  /* 音频 */
  volume: number
  muted: boolean

  /* 模拟器 */
  defaultCore: EmulatorCore
  screenFilter: ScreenFilter
  integerScale: boolean
  showFps: boolean
  /** 运行满 N 秒后自动截图当封面，0 = 关闭 */
  autoScreenshotAfterSec: number
  /** 自动存档间隔秒数，0 = 关闭 */
  autoSaveIntervalSec: number

  /* 自动备份 */
  /** 自动备份总开关（定时 + 退出时都受它控制） */
  autoBackupEnabled: boolean
  /** 定时备份间隔（小时）；0 = 仅退出时备份，不做定点定时 */
  autoBackupIntervalHrs: number
  /** 页面切到后台 / 关闭时自动下载一份备份 */
  autoBackupOnExit: boolean

  /* 输入 */
  keyboardMap: KeyboardMap
  gamepadMap: GamepadMap
  turbo: TurboConfig
  vibration: boolean
  /** 移动端虚拟手柄不透明度 0.2~1 */
  touchOpacity: number
  /** 移动端虚拟手柄尺寸倍率 0.7~1.4 */
  touchScale: number
}

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  durationMs: number
}

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}
