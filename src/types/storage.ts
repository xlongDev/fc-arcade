/**
 * 持久化契约。
 *
 * 分层原则：games 表只存元数据（KB 级），列表页只查它；
 * ROM blob 单独放 roms 表，只有进播放器时才按 id 取——这是 ROM 懒加载的强制边界。
 */
import type { EmulatorCore } from './emulator'
import type { GameRecord } from './game'

export const DB_NAME = 'fc-arcade'
export const DB_VERSION = 1

export interface RomRow {
  id: string
  blob: Blob
  size: number
  crc32: string
}

/** generated 层是运行时算出来的，不落库；只有 screenshot / custom 进这张表 */
export interface CoverRow {
  gameId: string
  kind: 'screenshot' | 'custom'
  blob: Blob
  width: number
  height: number
  updatedAt: number
}

export type SaveSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 'auto'

export const SAVE_SLOTS: readonly SaveSlot[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export interface SaveStateRow {
  id: string
  gameId: string
  slot: SaveSlot
  core: EmulatorCore
  version: number
  /** 序列化后的存档数据 */
  blob: Blob
  /** 存档时的画面缩略图 */
  thumb: Blob | null
  label: string | null
  createdAt: number
}

export interface SessionRow {
  id: string
  gameId: string
  startedAt: number
  durationMs: number
}

/** CRC 自学习表：用户纠正过一次，下次同 ROM 就精确命中 */
export interface CrcLearnRow {
  crc32: string
  titleId: string
  learnedAt: number
}

export interface StorageUsage {
  usage: number
  quota: number
  persisted: boolean
  /** 各类数据的占用估算 */
  breakdown: {
    roms: number
    covers: number
    saveStates: number
  }
}

/* --------------------------------- DAO --------------------------------- */

export interface GameQuery {
  keyword?: string
  categories?: string[]
  yearRange?: [number, number] | null
  favoriteOnly?: boolean
  sortBy?: GameSortKey
  sortDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export type GameSortKey =
  | 'lastPlayedAt'
  | 'addedAt'
  | 'title'
  | 'year'
  | 'playCount'
  | 'totalPlayMs'

export interface GameDao {
  list(query?: GameQuery): Promise<GameRecord[]>
  getAll(): Promise<GameRecord[]>
  get(id: string): Promise<GameRecord | undefined>
  findByCrc(crc32: string): Promise<GameRecord | undefined>
  add(record: GameRecord): Promise<string>
  bulkAdd(records: GameRecord[]): Promise<string[]>
  update(id: string, patch: Partial<GameRecord>): Promise<void>
  /** 同时删除关联的 rom / cover / saveStates */
  remove(id: string): Promise<void>
  removeMany(ids: string[]): Promise<void>
  count(): Promise<number>
  /** 清空所有游戏记录 */
  clear(): Promise<void>
}

export interface RomDao {
  get(id: string): Promise<RomRow | undefined>
  getBuffer(id: string): Promise<ArrayBuffer | undefined>
  put(row: RomRow): Promise<void>
  remove(id: string): Promise<void>
  /** 清空所有 ROM 二进制 */
  clear(): Promise<void>
}

export interface CoverDao {
  get(gameId: string): Promise<CoverRow | undefined>
  getMany(gameIds: string[]): Promise<Map<string, CoverRow>>
  put(row: CoverRow): Promise<void>
  remove(gameId: string): Promise<void>
  /** 清空所有封面 */
  clear(): Promise<void>
}

export interface SaveStateDao {
  listByGame(gameId: string): Promise<SaveStateRow[]>
  get(id: string): Promise<SaveStateRow | undefined>
  getBySlot(gameId: string, slot: SaveSlot): Promise<SaveStateRow | undefined>
  put(row: SaveStateRow): Promise<void>
  remove(id: string): Promise<void>
  removeByGame(gameId: string): Promise<void>
  /** 清空所有存档 */
  clear(): Promise<void>
}

export interface SessionDao {
  add(row: SessionRow): Promise<void>
  recentGameIds(limit: number): Promise<string[]>
  totalMsByGame(gameId: string): Promise<number>
  /** 清空所有游玩会话 */
  clear(): Promise<void>
}

export interface CrcLearnDao {
  get(crc32: string): Promise<CrcLearnRow | undefined>
  put(row: CrcLearnRow): Promise<void>
  getAll(): Promise<CrcLearnRow[]>
  /** 清空所有 CRC 自学习记录 */
  clear(): Promise<void>
}

/* ------------------------- 导出 / 导入（备份） -------------------------- */

/** 备份文件清单（zip 内的 manifest.json）。备份是一个含二进制本体的完整快照。 */
export interface BackupManifest {
  format: 'fc-arcade-backup' | 'fc-arcade-saves'
  /** 备份格式版本，不兼容时升级并写迁移 */
  version: number
  /** 导出时的应用版本，仅作展示 */
  appVersion: string
  createdAt: number
  /** 是否包含 ROM/封面/存档等二进制本体（完整备份恒为 true；存档备份恒为 false） */
  includesRoms: boolean
  counts: {
    games: number
    roms: number
    covers: number
    saveStates: number
    sessions: number
    crcLearn: number
    settings: boolean
  }
}
