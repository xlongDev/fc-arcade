/**
 * 全局状态统一出口。
 * 其他模块一律 `import { useSettingsStore } from '@/store'`，不要深入 import 子文件。
 */
export type { SettingsState } from './settingsStore'
export {
  DEFAULT_INPUT_MAPS,
  DEFAULT_SETTINGS,
  mergeSettings,
  SETTINGS_VERSION,
  useSettings,
  useSettingsStore,
} from './settingsStore'

export type { LibraryState } from './libraryStore'
export { hasActiveFilter, useLibraryStore } from './libraryStore'

export type { GamesState, UseFilteredGamesResult, UseGamesResult } from './gamesStore'
export { useFilteredGames, useGame, useGames, useGamesStore } from './gamesStore'
