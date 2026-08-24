/**
 * 持久化层统一出口。
 * 其他模块一律 `import { gameDao } from '@/data'`，不要深入 import 子文件。
 */
export type { FcArcadeDatabase } from './db'
export { clearAllData, db } from './db'

export { coverDao, crcLearnDao, gameDao, romDao, saveStateDao, sessionDao, withDerivedFields } from './dao'

export { getStorageUsage, requestPersistence } from './storage'

export { getEditedFields, mergeMeta, OVERRIDABLE_KEYS, toGameView } from './view'

export {
  BackupError,
  BACKUP_EXTENSION,
  BACKUP_FORMAT_VERSION,
  downloadBackup,
  downloadSaveStatesBackup,
  exportBackup,
  exportSaveStates,
  importBackup,
  importSaveStates,
  previewBackup,
  previewSaveStatesBackup,
} from './backup'
export type {
  BackupPreview,
  BackupProgress,
  ExportOptions,
  PreviewOptions,
  RestoreOptions,
  RestoreProgress,
  RestoreSummary,
} from './backup'

export type { FilterInput } from './query'
export { applyGameQuery, filterGames, sortGames } from './query'
