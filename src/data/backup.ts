/**
 * 备份导出 / 导入。
 *
 * 痛点：游戏 ROM、存档、封面只存在本机 IndexedDB，换设备 / 清缓存就全没了。
 * 这里把六张表 + 设置打包成一个 zip（.fcab），解决「可移植」问题。
 *
 * 文件结构（zip 内）：
 *   manifest.json          清单（格式版本、计数、是否含二进制）
 *   games.json            游戏元数据（GameRecord[]，含派生字段，导入时重算）
 *   sessions.json         游玩会话
 *   crcLearn.json         CRC 自学习表
 *   roms.json            ROM 元信息（去 blob：id/size/crc32）
 *   roms/<id>.bin        ROM 二进制
 *   covers.json          封面元信息（去 blob）
 *   covers/<gameId>.bin   封面二进制
 *   saveStates.json      存档元信息（去 blob/thumb）
 *   saveStates/<id>.bin  存档二进制
 *   saveStates/thumbs/<id>.bin  存档缩略图
 *   settings.json        localStorage 里 `fc-arcade-settings` 的原始字符串
 *
 * 二进制一律按 id 命名，导入时用正则捞出 blob、再用 json 里的元信息拼回整行。
 */
import type { CoverRow, CrcLearnRow, RomRow, SaveStateRow, SessionRow } from '@/types/storage'
import type { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

/** fflate 按需懒加载时用的模块形态（只取用到的 4 个函数，避免把整库静态打进首屏） */
type FflateModule = {
  strToU8: typeof strToU8
  strFromU8: typeof strFromU8
  zipSync: typeof zipSync
  unzipSync: typeof unzipSync
}
import type { BackupManifest } from '@/types/storage'
import type { GameRecord } from '@/types/game'
import { SETTINGS_STORAGE_KEY } from '@/config/defaults'

import { crcLearnDao, db, gameDao } from './index'
import { saveStateDao } from './dao'
import { clearAllData } from './db'
import { withDerivedFields } from './dao'

export const BACKUP_FORMAT_VERSION = 1
/** 仅作展示，无版本约束意义 */
export const APP_VERSION = '1.0.0'
export const BACKUP_EXTENSION = 'fcab'
const BACKUP_MIME = 'application/x-fc-arcade-backup'
const MANIFEST_NAME = 'manifest.json'

/* ------------------------------- 类型契约 ------------------------------- */

export type BackupStage = 'reading' | 'packing' | 'done' | 'error'
export interface BackupProgress {
  stage: BackupStage
  label: string
  processed: number
  total: number
}

export interface ExportOptions {
  /** 是否把设置（localStorage）一并打包，默认 true */
  includeSettings?: boolean
  onProgress?: (p: BackupProgress) => void
  signal?: AbortSignal
}

export type RestoreStage = 'reading' | 'parsing' | 'writing' | 'done' | 'error'
export interface RestoreProgress {
  stage: RestoreStage
  label: string
  processed: number
  total: number
}

export interface RestoreOptions {
  /** merge = 按 id 合并（不删已有）；replace = 先清空再恢复 */
  mode?: 'merge' | 'replace'
  onProgress?: (p: RestoreProgress) => void
  signal?: AbortSignal
}

export interface RestoreSummary {
  games: number
  roms: number
  covers: number
  saveStates: number
  sessions: number
  crcLearn: number
  settings: boolean
  errors: string[]
}

/** 导入前的预览：清单计数 + 抽样的若干游戏标题，让用户在恢复前先看清内容 */
export interface BackupPreview {
  manifest: BackupManifest
  games: number
  roms: number
  covers: number
  saveStates: number
  sessions: number
  crcLearn: number
  settings: boolean
  /** 抽样展示的前几个游戏标题（取 detected.title，缺失时退化为文件名） */
  sampleTitles: string[]
}

export class BackupError extends Error {
  constructor(
    public code: 'INVALID_FILE' | 'UNSUPPORTED_VERSION' | 'ABORTED',
    message: string,
  ) {
    super(message)
    this.name = 'BackupError'
  }
}

/* ------------------------------- 元信息剥离 ------------------------------- */
/** ROM 行去掉 blob 后的可序列化形态 */
type RomMeta = Omit<RomRow, 'blob'>
type CoverMeta = Omit<CoverRow, 'blob'>
type SaveStateMeta = Omit<SaveStateRow, 'blob' | 'thumb'>

/* ------------------------------- 小工具 ------------------------------- */

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * fflate 按需懒加载（仅导出/导入时拉取，避免把 zip 库打进首屏）。
 * 用模块级缓存，整个会话只 import 一次。
 */
let _fflate: FflateModule | null = null
async function getFflate(): Promise<FflateModule> {
  if (_fflate === null) _fflate = await import('fflate')
  return _fflate
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new BackupError('ABORTED', '操作已取消')
}

function readSettingsRaw(): string | null {
  try {
    return localStorage.getItem(SETTINGS_STORAGE_KEY)
  } catch {
    return null
  }
}

function parseJsonArray<T>(
  bytes: Uint8Array | undefined,
  strFromU8: (data: Uint8Array, latin1?: boolean) => string,
): T[] {
  if (!bytes) return []
  try {
    const parsed: unknown = JSON.parse(strFromU8(bytes))
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

/** 把 unzipSync 产出的 Uint8Array 安全转成 Blob（复制进独立 ArrayBuffer，规避 TS 7 的 buffer 泛型分歧） */
function toBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Blob([copy])
}

/** 从 games.json 里抽出前几个标题用于预览（标题在 detected.title，缺失则退化为文件名） */
function extractSampleTitles(
  bytes: Uint8Array | undefined,
  strFromU8: (data: Uint8Array, latin1?: boolean) => string,
  limit = 8,
): string[] {
  if (!bytes) return []
  try {
    const parsed = JSON.parse(strFromU8(bytes)) as Array<{
      detected?: { title?: string }
      fileName?: string
    }>
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((game) => game.detected?.title || game.fileName || '(未命名)')
      .filter((title): title is string => typeof title === 'string' && title.length > 0)
      .slice(0, limit)
  } catch {
    return []
  }
}

/* ------------------------------- 导出 ------------------------------- */

export async function exportBackup(options: ExportOptions = {}): Promise<Blob> {
  const { includeSettings = true, onProgress, signal } = options
  throwIfAborted(signal)

  onProgress?.({ stage: 'reading', label: '读取游戏元数据…', processed: 0, total: 6 })

  const [games, roms, covers, saveStates, sessions, crcLearn] = await Promise.all([
    gameDao.getAll(),
    db.roms.toArray(),
    db.covers.toArray(),
    db.saveStates.toArray(),
    db.sessions.toArray(),
    crcLearnDao.getAll(),
  ])
  const settings = includeSettings ? readSettingsRaw() : null
  throwIfAborted(signal)

  onProgress?.({ stage: 'reading', label: '读取完成', processed: 6, total: 6 })

  const { strToU8, zipSync } = await getFflate()

  const files: Record<string, Uint8Array> = {}
  const manifest: BackupManifest = {
    format: 'fc-arcade-backup',
    version: BACKUP_FORMAT_VERSION,
    appVersion: APP_VERSION,
    createdAt: Date.now(),
    includesRoms: true,
    counts: {
      games: games.length,
      roms: roms.length,
      covers: covers.length,
      saveStates: saveStates.length,
      sessions: sessions.length,
      crcLearn: crcLearn.length,
      settings: settings !== null,
    },
  }
  files[MANIFEST_NAME] = strToU8(JSON.stringify(manifest, null, 2))
  files['games.json'] = strToU8(JSON.stringify(games))
  files['sessions.json'] = strToU8(JSON.stringify(sessions))
  files['crcLearn.json'] = strToU8(JSON.stringify(crcLearn))
  if (settings !== null) files['settings.json'] = strToU8(settings)
  // JSON 元信息用默认 UTF-8；第二个参数 true 会让 fflate 走 latin1，损坏中文 label。
  files['roms.json'] = strToU8(
    JSON.stringify(roms.map(({ id, size, crc32 }) => ({ id, size, crc32 }))),
  )
  files['covers.json'] = strToU8(
    JSON.stringify(
      covers.map(({ gameId, kind, width, height, updatedAt }) => ({
        gameId,
        kind,
        width,
        height,
        updatedAt,
      })),
    ),
  )
  files['saveStates.json'] = strToU8(
    JSON.stringify(
      saveStates.map(({ id, gameId, slot, core, version, label, createdAt }) => ({
        id,
        gameId,
        slot,
        core,
        version,
        label,
        createdAt,
      })),
    ),
  )

  // 二进制本体：逐个读 ArrayBuffer 并写入 zip，按 id 命名，带进度与让出
  const binaries: Array<{ path: string; blob: Blob }> = []
  for (const rom of roms) binaries.push({ path: `roms/${rom.id}.bin`, blob: rom.blob })
  for (const cover of covers) binaries.push({ path: `covers/${cover.gameId}.bin`, blob: cover.blob })
  for (const sv of saveStates) {
    binaries.push({ path: `saveStates/${sv.id}.bin`, blob: sv.blob })
    if (sv.thumb) binaries.push({ path: `saveStates/thumbs/${sv.id}.bin`, blob: sv.thumb })
  }

  const total = binaries.length
  onProgress?.({ stage: 'packing', label: '打包 ROM 与存档…', processed: 0, total })
  let done = 0
  // 逐条读取 + 进度 + 让出主线程：刻意串行而非 Promise.all，避免一次性把全部
  // ROM/存档读进内存；yieldToMain 用于在大体积备份时保持界面响应与中止检查。
  /* eslint-disable eslint/no-await-in-loop */
  for (const item of binaries) {
    const buf = new Uint8Array(await item.blob.arrayBuffer())
    files[item.path] = buf
    done += 1
    onProgress?.({ stage: 'packing', label: '打包 ROM 与存档…', processed: done, total })
    if (done % 8 === 0) await yieldToMain()
    throwIfAborted(signal)
  }
  /* eslint-enable eslint/no-await-in-loop */

  const zipped = zipSync(files, { level: 6 })
  onProgress?.({ stage: 'done', label: '完成', processed: total, total })
  return new Blob([zipped], { type: BACKUP_MIME })
}

/** 导出并触发浏览器下载 */
export async function downloadBackup(options: ExportOptions = {}): Promise<void> {
  const blob = await exportBackup(options)
  const stamp = new Date().toISOString().slice(0, 10)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `fc-arcade-backup-${stamp}.${BACKUP_EXTENSION}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // 延迟回收，确保下载已开始
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ------------------------------- 导入 ------------------------------- */

export async function importBackup(
  source: Blob | ArrayBuffer,
  options: RestoreOptions = {},
): Promise<RestoreSummary> {
  const { mode = 'merge', onProgress, signal } = options
  throwIfAborted(signal)

  onProgress?.({ stage: 'reading', label: '解包备份文件…', processed: 0, total: 5 })
  const bytes =
    source instanceof ArrayBuffer ? new Uint8Array(source) : new Uint8Array(await source.arrayBuffer())

  const { unzipSync, strFromU8 } = await getFflate()

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new BackupError('INVALID_FILE', '文件不是有效的备份（zip 解析失败）')
  }
  throwIfAborted(signal)

  // 校验清单
  const manifestBytes = files[MANIFEST_NAME]
  if (!manifestBytes) throw new BackupError('INVALID_FILE', '备份缺少 manifest.json')
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest
  } catch {
    throw new BackupError('INVALID_FILE', 'manifest.json 解析失败')
  }
  if (manifest.format !== 'fc-arcade-backup')
    throw new BackupError('INVALID_FILE', '不是 FC Arcade 备份文件')
  if (manifest.version > BACKUP_FORMAT_VERSION)
    throw new BackupError(
      'UNSUPPORTED_VERSION',
      `备份版本 v${manifest.version} 高于当前支持的最高版本 v${BACKUP_FORMAT_VERSION}`,
    )

  onProgress?.({ stage: 'parsing', label: '解析数据…', processed: 1, total: 5 })

  const games = parseJsonArray<GameRecord>(files['games.json'], strFromU8)
  if (games.length === 0)
    throw new BackupError('INVALID_FILE', '备份缺少 games.json 或为空')
  const sessions = parseJsonArray<SessionRow>(files['sessions.json'], strFromU8)
  const crcLearn = parseJsonArray<CrcLearnRow>(files['crcLearn.json'], strFromU8)
  const romMetas = parseJsonArray<RomMeta>(files['roms.json'], strFromU8)
  const coverMetas = parseJsonArray<CoverMeta>(files['covers.json'], strFromU8)
  const ssMetas = parseJsonArray<SaveStateMeta>(files['saveStates.json'], strFromU8)
  const settingsBytes = files['settings.json']
  throwIfAborted(signal)

  // 把二进制按 id 捞进 Map，导入时按 json 元信息拼回整行
  const romBlobs = new Map<string, Uint8Array>()
  const coverBlobs = new Map<string, Uint8Array>()
  const ssBlobs = new Map<string, Uint8Array>()
  const ssThumbs = new Map<string, Uint8Array>()
  for (const key of Object.keys(files)) {
    let m: RegExpExecArray | null
    if ((m = /^roms\/([^/]+)\.bin$/.exec(key))) romBlobs.set(decodeURIComponent(m[1]), files[key])
    else if ((m = /^covers\/([^/]+)\.bin$/.exec(key)))
      coverBlobs.set(decodeURIComponent(m[1]), files[key])
    else if ((m = /^saveStates\/thumbs\/([^/]+)\.bin$/.exec(key)))
      ssThumbs.set(decodeURIComponent(m[1]), files[key])
    else if ((m = /^saveStates\/([^/]+)\.bin$/.exec(key)))
      ssBlobs.set(decodeURIComponent(m[1]), files[key])
  }

  const summary: RestoreSummary = {
    games: 0,
    roms: 0,
    covers: 0,
    saveStates: 0,
    sessions: 0,
    crcLearn: 0,
    settings: false,
    errors: [],
  }

  if (mode === 'replace') {
    await clearAllData()
  }

  onProgress?.({ stage: 'writing', label: '写入数据库…', processed: 2, total: 5 })

  await db.transaction(
    'rw',
    [db.games, db.roms, db.covers, db.saveStates, db.sessions, db.crcLearn],
    async () => {
      // 游戏元数据（重算派生字段，保证与当前代码一致）
      const gameRecords = games.map((g) => withDerivedFields(g))
      if (gameRecords.length > 0) await db.games.bulkPut(gameRecords)
      summary.games = gameRecords.length

      // ROM 二进制
      const romRows: RomRow[] = []
      for (const meta of romMetas) {
        const b = romBlobs.get(meta.id)
        if (!b) {
          summary.errors.push(`ROM ${meta.id} 的二进制缺失，已跳过`)
          continue
        }
        romRows.push({ ...meta, blob: toBlob(b) })
      }
      if (romRows.length > 0) await db.roms.bulkPut(romRows)
      summary.roms = romRows.length

      // 封面
      const coverRows = []
      for (const meta of coverMetas) {
        const b = coverBlobs.get(meta.gameId)
        if (!b) {
          summary.errors.push(`封面 ${meta.gameId} 的二进制缺失，已跳过`)
          continue
        }
        coverRows.push({ ...meta, blob: toBlob(b) })
      }
      if (coverRows.length > 0) await db.covers.bulkPut(coverRows)
      summary.covers = coverRows.length

      // 存档（含缩略图）
      const ssRows = []
      for (const meta of ssMetas) {
        const b = ssBlobs.get(meta.id)
        if (!b) {
          summary.errors.push(`存档 ${meta.id} 的二进制缺失，已跳过`)
          continue
        }
        ssRows.push({
          ...meta,
          blob: toBlob(b),
          thumb: ssThumbs.has(meta.id) ? toBlob(ssThumbs.get(meta.id)!) : null,
        })
      }
      if (ssRows.length > 0) await db.saveStates.bulkPut(ssRows)
      summary.saveStates = ssRows.length

      // 会话
      if (sessions.length > 0) await db.sessions.bulkPut(sessions)
      summary.sessions = sessions.length

      // CRC 自学习表
      if (crcLearn.length > 0) await db.crcLearn.bulkPut(crcLearn)
      summary.crcLearn = crcLearn.length
    },
  )

  // 设置（localStorage）——写回后由 UI 调用 settingsStore.persist.rehydrate() 应用
  if (settingsBytes) {
    try {
      const text = strFromU8(settingsBytes)
      localStorage.setItem(SETTINGS_STORAGE_KEY, text)
      summary.settings = true
    } catch {
      summary.errors.push('设置恢复失败（localStorage 不可用）')
    }
  }

  onProgress?.({ stage: 'done', label: '完成', processed: 5, total: 5 })
  return summary
}

/* ------------------------------- 单独导出 / 导入存档 ------------------------------- */

const SAVES_FORMAT = 'fc-arcade-saves' as const
const SAVES_MANIFEST_NAME = 'manifest.json'

async function buildSaveStatesArchive(
  saveStates: SaveStateRow[],
  options: ExportOptions = {},
): Promise<Blob> {
  const { onProgress, signal } = options
  throwIfAborted(signal)

  const { strToU8, zipSync } = await getFflate()

  const files: Record<string, Uint8Array> = {}
  const manifest: BackupManifest = {
    format: SAVES_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    appVersion: APP_VERSION,
    createdAt: Date.now(),
    includesRoms: false,
    counts: {
      games: 0,
      roms: 0,
      covers: 0,
      saveStates: saveStates.length,
      sessions: 0,
      crcLearn: 0,
      settings: false,
    },
  }
  files[SAVES_MANIFEST_NAME] = strToU8(JSON.stringify(manifest, null, 2))
  files['saveStates.json'] = strToU8(
    JSON.stringify(
      saveStates.map(({ id, gameId, slot, core, version, label, createdAt }) => ({
        id,
        gameId,
        slot,
        core,
        version,
        label,
        createdAt,
      })),
    ),
  )

  const binaries: Array<{ path: string; blob: Blob }> = []
  for (const sv of saveStates) {
    binaries.push({ path: `saveStates/${sv.id}.bin`, blob: sv.blob })
    if (sv.thumb) binaries.push({ path: `saveStates/thumbs/${sv.id}.bin`, blob: sv.thumb })
  }

  const total = binaries.length
  onProgress?.({ stage: 'packing', label: '打包存档…', processed: 0, total })
  let done = 0
  // 逐条读取 + 进度 + 让出主线程：刻意串行而非 Promise.all，避免一次性把全部存档读进内存。
  /* eslint-disable eslint/no-await-in-loop */
  for (const item of binaries) {
    const buf = new Uint8Array(await item.blob.arrayBuffer())
    files[item.path] = buf
    done += 1
    onProgress?.({ stage: 'packing', label: '打包存档…', processed: done, total })
    if (done % 8 === 0) await yieldToMain()
    throwIfAborted(signal)
  }
  /* eslint-enable eslint/no-await-in-loop */

  const zipped = zipSync(files, { level: 6 })
  onProgress?.({ stage: 'done', label: '完成', processed: total, total })
  return new Blob([zipped], { type: BACKUP_MIME })
}

export async function exportSaveStates(options: ExportOptions = {}): Promise<Blob> {
  const { onProgress, signal } = options
  throwIfAborted(signal)

  onProgress?.({ stage: 'reading', label: '读取存档…', processed: 0, total: 1 })
  const saveStates = await db.saveStates.toArray()
  throwIfAborted(signal)
  onProgress?.({ stage: 'reading', label: '读取完成', processed: 1, total: 1 })

  return buildSaveStatesArchive(saveStates, options)
}

export async function exportSaveStatesByGame(
  gameId: string,
  options: ExportOptions = {},
): Promise<Blob> {
  const { onProgress, signal } = options
  throwIfAborted(signal)

  onProgress?.({ stage: 'reading', label: '读取存档…', processed: 0, total: 1 })
  const saveStates = await saveStateDao.listByGame(gameId)
  throwIfAborted(signal)
  onProgress?.({ stage: 'reading', label: '读取完成', processed: 1, total: 1 })

  if (saveStates.length === 0) {
    throw new Error('该游戏没有存档')
  }

  return buildSaveStatesArchive(saveStates, options)
}

export async function downloadSaveStatesBackup(options: ExportOptions = {}): Promise<void> {
  const blob = await exportSaveStates(options)
  const stamp = new Date().toISOString().slice(0, 10)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `fc-arcade-saves-${stamp}.${BACKUP_EXTENSION}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadSaveStatesByGame(
  gameId: string,
  title?: string,
  options: ExportOptions = {},
): Promise<void> {
  const blob = await exportSaveStatesByGame(gameId, options)
  const stamp = new Date().toISOString().slice(0, 10)
  const safeTitle = title ? title.replace(/[/\\?%*:|"<>]/g, '_') : gameId.slice(0, 8)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `fc-arcade-saves-${safeTitle}-${stamp}.${BACKUP_EXTENSION}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importSaveStates(
  source: Blob | ArrayBuffer,
  options: RestoreOptions = {},
): Promise<RestoreSummary> {
  const { mode = 'merge', onProgress, signal } = options
  throwIfAborted(signal)

  onProgress?.({ stage: 'reading', label: '解包存档备份…', processed: 0, total: 3 })
  const bytes =
    source instanceof ArrayBuffer ? new Uint8Array(source) : new Uint8Array(await source.arrayBuffer())

  const { unzipSync, strFromU8 } = await getFflate()

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new BackupError('INVALID_FILE', '文件不是有效的存档备份（zip 解析失败）')
  }
  throwIfAborted(signal)

  const manifestBytes = files[SAVES_MANIFEST_NAME]
  if (!manifestBytes) throw new BackupError('INVALID_FILE', '备份缺少 manifest.json')
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest
  } catch {
    throw new BackupError('INVALID_FILE', 'manifest.json 解析失败')
  }
  if (manifest.format !== SAVES_FORMAT)
    throw new BackupError('INVALID_FILE', '不是 FC Arcade 存档备份文件')
  if (manifest.version > BACKUP_FORMAT_VERSION)
    throw new BackupError(
      'UNSUPPORTED_VERSION',
      `备份版本 v${manifest.version} 高于当前支持的最高版本 v${BACKUP_FORMAT_VERSION}`,
    )

  onProgress?.({ stage: 'parsing', label: '解析存档…', processed: 1, total: 3 })
  const ssMetas = parseJsonArray<SaveStateMeta>(files['saveStates.json'], strFromU8)
  const ssBlobs = new Map<string, Uint8Array>()
  const ssThumbs = new Map<string, Uint8Array>()
  for (const key of Object.keys(files)) {
    let m: RegExpExecArray | null
    if ((m = /^saveStates\/thumbs\/([^/]+)\.bin$/.exec(key)))
      ssThumbs.set(decodeURIComponent(m[1]), files[key])
    else if ((m = /^saveStates\/([^/]+)\.bin$/.exec(key))) ssBlobs.set(decodeURIComponent(m[1]), files[key])
  }
  throwIfAborted(signal)

  const summary: RestoreSummary = {
    games: 0,
    roms: 0,
    covers: 0,
    saveStates: 0,
    sessions: 0,
    crcLearn: 0,
    settings: false,
    errors: [],
  }

  onProgress?.({ stage: 'writing', label: '写入存档…', processed: 2, total: 3 })
  await db.transaction('rw', [db.saveStates], async () => {
    if (mode === 'replace') await db.saveStates.clear()

    const ssRows = []
    for (const meta of ssMetas) {
      const b = ssBlobs.get(meta.id)
      if (!b) {
        summary.errors.push(`存档 ${meta.id} 的二进制缺失，已跳过`)
        continue
      }
      ssRows.push({
        ...meta,
        blob: toBlob(b),
        thumb: ssThumbs.has(meta.id) ? toBlob(ssThumbs.get(meta.id)!) : null,
      })
    }
    if (ssRows.length > 0) await db.saveStates.bulkPut(ssRows)
    summary.saveStates = ssRows.length
  })

  onProgress?.({ stage: 'done', label: '完成', processed: 3, total: 3 })
  return summary
}

export async function previewSaveStatesBackup(
  source: Blob | ArrayBuffer,
  options: PreviewOptions = {},
): Promise<BackupPreview> {
  const { signal } = options
  throwIfAborted(signal)

  const bytes =
    source instanceof ArrayBuffer ? new Uint8Array(source) : new Uint8Array(await source.arrayBuffer())
  const { unzipSync, strFromU8 } = await getFflate()

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new BackupError('INVALID_FILE', '文件不是有效的存档备份（zip 解析失败）')
  }
  throwIfAborted(signal)

  const manifestBytes = files[SAVES_MANIFEST_NAME]
  if (!manifestBytes) throw new BackupError('INVALID_FILE', '备份缺少 manifest.json')
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest
  } catch {
    throw new BackupError('INVALID_FILE', 'manifest.json 解析失败')
  }
  if (manifest.format !== SAVES_FORMAT)
    throw new BackupError('INVALID_FILE', '不是 FC Arcade 存档备份文件')
  if (manifest.version > BACKUP_FORMAT_VERSION)
    throw new BackupError(
      'UNSUPPORTED_VERSION',
      `备份版本 v${manifest.version} 高于当前支持的最高版本 v${BACKUP_FORMAT_VERSION}`,
    )

  return {
    manifest,
    games: 0,
    roms: 0,
    covers: 0,
    saveStates: manifest.counts.saveStates,
    sessions: 0,
    crcLearn: 0,
    settings: false,
    sampleTitles: [],
  }
}

/* ------------------------------- 预览 ------------------------------- */

export interface PreviewOptions {
  signal?: AbortSignal
}

/**
 * 恢复前先解析备份，返回清单计数 + 抽样标题，供「预览备份内容」确认步骤使用。
 * 只读取 manifest.json / games.json，不触碰任何二进制，也不写库。
 */
export async function previewBackup(
  source: Blob | ArrayBuffer,
  options: PreviewOptions = {},
): Promise<BackupPreview> {
  const { signal } = options
  throwIfAborted(signal)

  const bytes =
    source instanceof ArrayBuffer
      ? new Uint8Array(source)
      : new Uint8Array(await source.arrayBuffer())

  const { unzipSync, strFromU8 } = await getFflate()

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new BackupError('INVALID_FILE', '文件不是有效的备份（zip 解析失败）')
  }
  throwIfAborted(signal)

  const manifestBytes = files[MANIFEST_NAME]
  if (!manifestBytes) throw new BackupError('INVALID_FILE', '备份缺少 manifest.json')
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest
  } catch {
    throw new BackupError('INVALID_FILE', 'manifest.json 解析失败')
  }
  if (manifest.format !== 'fc-arcade-backup')
    throw new BackupError('INVALID_FILE', '不是 FC Arcade 备份文件')
  if (manifest.version > BACKUP_FORMAT_VERSION)
    throw new BackupError(
      'UNSUPPORTED_VERSION',
      `备份版本 v${manifest.version} 高于当前支持的最高版本 v${BACKUP_FORMAT_VERSION}`,
    )

  throwIfAborted(signal)

  const sampleTitles = extractSampleTitles(files['games.json'], strFromU8)

  return {
    manifest,
    games: manifest.counts.games,
    roms: manifest.counts.roms,
    covers: manifest.counts.covers,
    saveStates: manifest.counts.saveStates,
    sessions: manifest.counts.sessions,
    crcLearn: manifest.counts.crcLearn,
    settings: manifest.counts.settings,
    sampleTitles,
  }
}
