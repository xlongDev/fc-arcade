/**
 * 游戏元数据契约。
 *
 * 核心设计：detected（识别管线产出）与 overrides（用户手动编辑）分开存储，
 * 渲染时合并为 GameView。重新识别只覆盖 detected，用户改过的字段永不被冲掉。
 */
import type { EmulatorCore } from './emulator'

export type GameCategory =
  | 'action'
  | 'platformer'
  | 'shooter'
  | 'rpg'
  | 'adventure'
  | 'puzzle'
  | 'sports'
  | 'racing'
  | 'fighting'
  | 'strategy'
  | 'simulation'
  | 'educational'
  | 'other'

export const GAME_CATEGORIES: readonly GameCategory[] = [
  'action',
  'platformer',
  'shooter',
  'rpg',
  'adventure',
  'puzzle',
  'sports',
  'racing',
  'fighting',
  'strategy',
  'simulation',
  'educational',
  'other',
] as const

export const CATEGORY_LABEL: Readonly<Record<GameCategory, string>> = {
  action: '动作',
  platformer: '平台跳跃',
  shooter: '射击',
  rpg: '角色扮演',
  adventure: '冒险',
  puzzle: '益智',
  sports: '体育',
  racing: '竞速',
  fighting: '格斗',
  strategy: '策略',
  simulation: '模拟',
  educational: '教育',
  other: '其他',
}

export type Region = 'JP' | 'US' | 'EU' | 'CN' | 'World' | 'Unknown'

export const REGION_LABEL: Readonly<Record<Region, string>> = {
  JP: '日版',
  US: '美版',
  EU: '欧版',
  CN: '中文版',
  World: '世界版',
  Unknown: '未知',
}

/** 识别置信度。exact = CRC 精确命中；none = 完全没匹配上，仅用文件名。 */
export type MatchConfidence = 'exact' | 'high' | 'medium' | 'low' | 'none'

export const CONFIDENCE_LABEL: Readonly<Record<MatchConfidence, string>> = {
  exact: '精确匹配',
  high: '高可信',
  medium: '可能匹配',
  low: '存疑',
  none: '未识别',
}

/* ------------------------------ ROM 静态信息 ----------------------------- */

export type Mirroring = 'horizontal' | 'vertical' | 'four-screen'
export type RomFormat = 'ines' | 'nes2' | 'raw'

export interface RomInfo {
  /** 8 位小写十六进制。跳过 16 字节 iNES 头后对 PRG+CHR 计算 */
  crc32: string
  /** 含文件头的总字节数 */
  sizeBytes: number
  mapper: number
  prgBanks: number
  chrBanks: number
  mirroring: Mirroring
  hasBattery: boolean
  hasTrainer: boolean
  format: RomFormat
}

/* -------------------------------- 元数据 -------------------------------- */

/** 识别管线产出，可被重新识别覆盖 */
export interface DetectedMeta {
  title: string
  /** 中文译名 / 通俗叫法，如「魂斗罗」 */
  titleAlias: string | null
  year: number | null
  categories: GameCategory[]
  developer: string | null
  publisher: string | null
  players: 1 | 2 | 3 | 4 | null
  region: Region
  description: string | null
  confidence: MatchConfidence
  /** 命中的内置标题库条目 id */
  matchedTitleId: string | null
}

/** 用户手动编辑的字段，优先级最高 */
export type UserOverrides = Partial<
  Pick<
    DetectedMeta,
    | 'title'
    | 'titleAlias'
    | 'year'
    | 'categories'
    | 'developer'
    | 'publisher'
    | 'players'
    | 'region'
    | 'description'
  >
>

export type CoverKind = 'generated' | 'screenshot' | 'custom'

/** 存进 IndexedDB 的原始记录 */
export interface GameRecord {
  id: string
  /** 指向 roms 表 */
  romId: string
  fileName: string
  detected: DetectedMeta
  overrides: UserOverrides
  rom: RomInfo
  /** 当前生效的封面层级：custom > screenshot > generated */
  coverKind: CoverKind
  favorite: boolean
  playCount: number
  totalPlayMs: number
  lastPlayedAt: number | null
  addedAt: number
  /** 归一化标题（小写、去符号、罗马数字转阿拉伯），Dexie 索引字段 */
  titleNorm: string
  /** 标题 + 别名 + 拼音首字母，预计算用于搜索 */
  searchText: string
  /** 该游戏偏好的内核，null 表示跟随全局设置 */
  preferredCore: EmulatorCore | null
}

/** detected + overrides 合并后的展示视图 */
export interface GameView extends DetectedMeta {
  id: string
  romId: string
  fileName: string
  rom: RomInfo
  coverKind: CoverKind
  favorite: boolean
  playCount: number
  totalPlayMs: number
  lastPlayedAt: number | null
  addedAt: number
  preferredCore: EmulatorCore | null
  /** 是否有任何字段被用户改过 */
  isEdited: boolean
  /** 被用户改过的字段名集合，UI 上可标记 */
  editedFields: ReadonlyArray<keyof UserOverrides>
}

/* ---------------------------- 内置标题库条目 ---------------------------- */

export interface TitleEntry {
  id: string
  title: string
  /** 常见别名（含日文原名、美版名、缩写） */
  aliases: string[]
  /** 中文译名 */
  cn: string | null
  year: number | null
  categories: GameCategory[]
  developer: string | null
  publisher: string | null
  players: 1 | 2 | 3 | 4 | null
  /** 已知 CRC32（内置库默认为空，由用户纠正后本地自学习填充） */
  crcs?: string[]
}

/* ------------------------------ 导入流程 -------------------------------- */

export type ImportStage = 'reading' | 'parsing' | 'matching' | 'writing' | 'done' | 'error'

export interface ImportCandidate {
  /** 临时 id，确认导入后才生成正式 GameRecord.id */
  tempId: string
  fileName: string
  fileSize: number
  rom: RomInfo | null
  detected: DetectedMeta | null
  /** 与库中已有游戏 CRC 重复 */
  duplicateOf: string | null
  error: string | null
  /** 用户在向导里是否勾选导入 */
  selected: boolean
  /** 用户在向导里就地修改的字段 */
  overrides: UserOverrides
}

export interface ImportProgress {
  stage: ImportStage
  total: number
  processed: number
  currentFile: string | null
}

export interface ImportResult {
  imported: number
  skipped: number
  failed: number
  gameIds: string[]
}
