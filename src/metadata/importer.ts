/**
 * 导入管线：文件 → 候选项 → 落库。
 *
 * 两个阶段之间隔着用户的确认（导入向导），所以 ROM 二进制不能塞进 ImportCandidate
 * （那是纯元数据类型，会进 React state）。这里用一张模块级的 tempId → Blob 暂存表衔接：
 * 非压缩包直接存 File 本身（浏览器托管在磁盘上，不占内存），
 * 只有从 zip 里解出来的条目才真正持有内存 Blob。
 */
import { unzipSync } from 'fflate'

import { db, gameDao, withDerivedFields } from '@/data'
import { uid } from '@/lib/id'
import type { GameRecord, ImportCandidate, ImportProgress, ImportResult } from '@/types/game'
import type { CrcLearnRow, RomRow } from '@/types/storage'

import { crc32 } from './crc32'
import { parseRom } from './ines'
import { createMatchContext, matchRom, titleIdForUserTitle } from './matcher'
import type { MatchContext } from './matcher'

export type ImportProgressFn = (progress: ImportProgress) => void

export interface ImportOptions {
  /** 取消导入。中断时抛出 AbortError */
  signal?: AbortSignal
}

/** 单个 ROM 体积上限。最大的合法 NES ROM 也就几 MB，超了基本是选错文件 */
const MAX_ROM_BYTES = 16 * 1024 * 1024

const ROM_ENTRY_EXT: ReadonlySet<string> = new Set(['nes', 'fds', 'unf', 'unif'])
/** 这些格式没有 iNES 头是正常的，不做魔数校验 */
const HEADERLESS_OK_EXT: ReadonlySet<string> = new Set(['fds', 'bin', 'rom', ''])

/* ------------------------------ ROM 暂存表 ------------------------------ */

interface PendingRom {
  blob: Blob
  crc32: string
  size: number
}

const pendingRoms = new Map<string, PendingRom>()

/** 丢弃暂存的 ROM 数据。取消导入或关闭向导时调用，避免 Blob 一直挂着 */
export function clearPendingRoms(): void {
  pendingRoms.clear()
}

/* -------------------------------- 小工具 -------------------------------- */

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new DOMException('导入已取消', 'AbortError')
  }
}

function extensionOf(name: string): string {
  const base = name.replace(/^.*[\\/]/, '')
  const dot = base.lastIndexOf('.')
  return dot < 0 ? '' : base.slice(dot + 1).toLowerCase()
}

function baseNameOf(path: string): string {
  return path.replace(/^.*[\\/]/, '')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer
  }
  return bytes.slice().buffer as ArrayBuffer
}

function messageOf(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message) return cause.message
  return fallback
}

/* ------------------------------- 解包与读取 ------------------------------ */

interface RomUnit {
  /** 展示用文件名。来自 zip 时形如 `合集包/Contra (U).nes` */
  fileName: string
  bytes: Uint8Array
  /** 落库用。非压缩包直接复用 File，省内存 */
  blob: Blob
}

function isRomEntry(path: string): boolean {
  if (path.startsWith('__MACOSX/') || path.includes('/__MACOSX/')) return false
  if (path.endsWith('/')) return false
  const name = baseNameOf(path)
  if (!name || name.startsWith('.')) return false
  return ROM_ENTRY_EXT.has(extensionOf(name))
}

/** 从 zip 里挑出 ROM 条目，readme.txt / 封面图之类的垃圾在解压前就被 filter 掉 */
function unpackZip(fileName: string, bytes: Uint8Array): RomUnit[] {
  const unzipped = unzipSync(bytes, {
    filter: (entry) => isRomEntry(entry.name) && entry.originalSize <= MAX_ROM_BYTES,
  })

  const zipBase = fileName.replace(/\.zip$/i, '')
  const units: RomUnit[] = []
  for (const path of Object.keys(unzipped).toSorted()) {
    const data = unzipped[path]
    if (!data || data.length === 0) continue
    units.push({
      fileName: `${zipBase}/${baseNameOf(path)}`,
      bytes: data,
      blob: new Blob([data]),
    })
  }
  return units
}

async function extractUnits(file: File): Promise<RomUnit[]> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (extensionOf(file.name) !== 'zip') {
    return [{ fileName: file.name, bytes, blob: file }]
  }

  let units: RomUnit[]
  try {
    units = unpackZip(file.name, bytes)
  } catch (cause) {
    throw new Error(messageOf(cause, '压缩包已损坏，无法解压'), { cause })
  }
  if (units.length === 0) {
    throw new Error('压缩包里没有找到 .nes / .fds / .unf 文件')
  }
  return units
}

/* ------------------------------- 候选项构建 ------------------------------ */

function failedCandidate(fileName: string, fileSize: number, error: string): ImportCandidate {
  return {
    tempId: uid('imp'),
    fileName,
    fileSize,
    rom: null,
    detected: null,
    duplicateOf: null,
    error,
    selected: false,
    overrides: {},
  }
}

interface DedupeState {
  /** 库里已有的全部 CRC，一次性取索引 key，不读记录本体 */
  existing: ReadonlySet<string>
  /** 本批次内已出现过的 CRC → 首个 tempId */
  seen: Map<string, string>
}

async function loadExistingCrcs(): Promise<Set<string>> {
  try {
    const keys = await db.games.orderBy('rom.crc32').keys()
    return new Set(keys.map((key) => String(key)))
  } catch {
    return new Set<string>()
  }
}

async function buildCandidate(
  unit: RomUnit,
  ctx: MatchContext,
  dedupe: DedupeState,
): Promise<ImportCandidate> {
  if (unit.bytes.length > MAX_ROM_BYTES) {
    return failedCandidate(unit.fileName, unit.bytes.length, '文件过大，不像是 FC 卡带数据')
  }

  let rom
  try {
    rom = parseRom(toArrayBuffer(unit.bytes))
  } catch (cause) {
    return failedCandidate(unit.fileName, unit.bytes.length, messageOf(cause, '解析 ROM 失败'))
  }

  // .nes / .unf 声称自己有文件头却没有魔数，多半是改名的其他文件，导进来也跑不起来
  if (rom.format === 'raw' && !HEADERLESS_OK_EXT.has(extensionOf(unit.fileName))) {
    return failedCandidate(
      unit.fileName,
      unit.bytes.length,
      '缺少 NES 文件头魔数，不是可用的 FC ROM',
    )
  }

  // 去头 CRC（No-Intro 惯例）与整文件 CRC 都查一遍，兼容不同来源的转储
  const wholeCrc = crc32(unit.bytes)
  const crcs = rom.crc32 === wholeCrc ? [rom.crc32] : [rom.crc32, wholeCrc]

  const tempId = uid('imp')
  let duplicateOf: string | null = null
  // 按 CRC 去重：命中即停（break），属于「首个命中」语义，刻意串行而非并行。
  /* eslint-disable eslint/no-await-in-loop */
  for (const crc of crcs) {
    const inBatch = dedupe.seen.get(crc)
    if (inBatch !== undefined) {
      duplicateOf = inBatch
      break
    }
    if (dedupe.existing.has(crc)) {
      const owner = await gameDao.findByCrc(crc).catch(() => undefined)
      duplicateOf = owner?.id ?? crc
      break
    }
  }
  /* eslint-enable eslint/no-await-in-loop */
  for (const crc of crcs) {
    if (!dedupe.seen.has(crc)) dedupe.seen.set(crc, tempId)
  }

  const outcome = await matchRom({ fileName: unit.fileName, crcs }, ctx)

  pendingRoms.set(tempId, { blob: unit.blob, crc32: rom.crc32, size: unit.bytes.length })

  return {
    tempId,
    fileName: unit.fileName,
    fileSize: unit.bytes.length,
    rom,
    detected: outcome.detected,
    duplicateOf,
    error: null,
    selected: duplicateOf === null,
    overrides: {},
  }
}

/* -------------------------------- 阶段一 -------------------------------- */

/**
 * 读取并识别一批文件，产出待确认的候选项。
 * zip 会被展开成多个候选项；解析失败的文件也会保留成带 error 的候选项，
 * 让用户在向导里看得见「哪个文件没进来、为什么」。
 */
export async function importFiles(
  files: readonly File[],
  onProgress?: ImportProgressFn,
  options?: ImportOptions,
): Promise<ImportCandidate[]> {
  pendingRoms.clear()

  const signal = options?.signal
  const total = files.length
  const emit = (stage: ImportProgress['stage'], processed: number, currentFile: string | null) => {
    onProgress?.({ stage, total, processed, currentFile })
  }

  const [existing, ctx] = await Promise.all([loadExistingCrcs(), createMatchContext()])
  const dedupe: DedupeState = { existing, seen: new Map() }
  const candidates: ImportCandidate[] = []

  // 逐文件串行：先让出主线程再解压（保证进度可见），单包内多 ROM 中途也要让出。
  // 进度上报与让出主线程（yieldToUi）刻意串行，不让 Promise.all 破坏进度粒度。
  /* eslint-disable eslint/no-await-in-loop */
  for (let i = 0; i < files.length; i += 1) {
    throwIfAborted(signal)
    const file = files[i]

    emit('reading', i, file.name)
    // 先让出一次，保证上面的进度能画出来，再干解压这种同步重活
    await yieldToUi()

    let units: RomUnit[]
    try {
      units = await extractUnits(file)
    } catch (cause) {
      candidates.push(failedCandidate(file.name, file.size, messageOf(cause, '读取文件失败')))
      emit('matching', i + 1, file.name)
      continue
    }

    emit('parsing', i, file.name)
    for (let u = 0; u < units.length; u += 1) {
      throwIfAborted(signal)
      candidates.push(await buildCandidate(units[u], ctx, dedupe))
      // 一个压缩包里可能有几十个 ROM，中途也要让出主线程
      if (u > 0 && u % 8 === 0) await yieldToUi()
    }

    emit('matching', i + 1, file.name)
  }
  /* eslint-enable eslint/no-await-in-loop */

  emit('done', total, null)
  return candidates
}

/* -------------------------------- 阶段二 -------------------------------- */

interface PreparedWrite {
  record: GameRecord
  romRow: RomRow
  learn: CrcLearnRow | null
}

/**
 * 把用户确认后的候选项写进库。
 *
 * 自学习闭环的写入端：用户在向导里改过标题的，把 CRC → 标题记进 crcLearn，
 * 下次同一个 ROM 直接精确命中。
 */
export async function commitImport(
  candidates: readonly ImportCandidate[],
  onProgress?: ImportProgressFn,
): Promise<ImportResult> {
  const total = candidates.length
  const emit = (processed: number, currentFile: string | null) => {
    onProgress?.({ stage: 'writing', total, processed, currentFile })
  }
  emit(0, null)

  const prepared: PreparedWrite[] = []
  const usedCrcs = new Set<string>()
  const now = Date.now()
  let skipped = 0
  let failed = 0

  // 准备阶段全部在事务外做：事务里一旦 await 非 Dexie 的 Promise，事务会提前提交
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]
    emit(i + 1, candidate.fileName)

    const { rom, detected } = candidate
    const romData = pendingRoms.get(candidate.tempId)
    if (candidate.error !== null || rom === null || detected === null || romData === undefined) {
      failed += 1
      continue
    }

    const crc = rom.crc32
    if (usedCrcs.has(crc)) {
      skipped += 1
      continue
    }
    // 写前再查一次库，确认没有并发重复写入；属于「先查后写」，刻意串行。
    // eslint-disable-next-line eslint/no-await-in-loop
    const existing = await gameDao.findByCrc(crc).catch(() => undefined)
    if (existing) {
      skipped += 1
      continue
    }
    usedCrcs.add(crc)

    const romId = uid('rom')
    const record: GameRecord = {
      id: uid('game'),
      romId,
      fileName: candidate.fileName,
      detected,
      overrides: candidate.overrides,
      rom,
      coverKind: 'generated',
      favorite: false,
      playCount: 0,
      totalPlayMs: 0,
      lastPlayedAt: null,
      addedAt: now,
      // 由 withDerivedFields 统一重算，这里只是占位
      titleNorm: '',
      searchText: '',
      preferredCore: null,
    }

    const userTitle = candidate.overrides.title?.trim()
    const learn: CrcLearnRow | null =
      userTitle && userTitle !== detected.title
        ? { crc32: crc, titleId: titleIdForUserTitle(userTitle), learnedAt: now }
        : null

    prepared.push({
      record,
      romRow: { id: romId, blob: romData.blob, size: romData.size, crc32: crc },
      learn,
    })
  }

  if (prepared.length === 0) {
    emit(total, null)
    return { imported: 0, skipped, failed, gameIds: [] }
  }

  // 整批原子写入：ROM 本体、元数据、自学习记录要么全进，要么都不进
  await db.transaction('rw', [db.games, db.roms, db.crcLearn], async () => {
    await db.roms.bulkPut(prepared.map((item) => item.romRow))
    await db.games.bulkAdd(prepared.map((item) => withDerivedFields(item.record)))
    const learned = prepared
      .map((item) => item.learn)
      .filter((row): row is CrcLearnRow => row !== null)
    if (learned.length > 0) await db.crcLearn.bulkPut(learned)
  })

  for (const candidate of candidates) {
    pendingRoms.delete(candidate.tempId)
  }

  emit(total, null)
  return {
    imported: prepared.length,
    skipped,
    failed,
    gameIds: prepared.map((item) => item.record.id),
  }
}
