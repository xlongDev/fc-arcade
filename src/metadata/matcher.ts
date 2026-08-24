/**
 * ROM 识别匹配器：多信号融合，按可信度从高到低依次尝试。
 *
 *   1. CRC32 精确匹配   —— 内置库里带 crcs 的条目（目前为空，预留给未来的数据包）
 *   2. CRC 自学习命中   —— 用户上次手工纠正过的 CRC → 标题，可信度等同精确匹配
 *   3. 文件名模糊匹配   —— Dice 系数 + 拼音首字母，扛脏文件名
 *   4. 兜底             —— 用清洗后的文件名当标题，标记为「未识别」
 *
 * 输出永远带 source 与 score，导入向导据此决定提示强度。
 *
 * 纯匹配逻辑（matchByFileName / resolveTitleId / titleIdForUserTitle / 索引构建等）
 * 已抽到 match-core.ts，本文件只保留需要读 IndexedDB 的 IO 路径（matchRom / 自学习）。
 */
import { crcLearnDao } from '@/data'
import type { CrcLearnRow } from '@/types/storage'
import type {
  DetectedMeta,
  MatchConfidence,
  Region,
  RomInfo,
  TitleEntry,
} from '@/types/game'
import { hasCjk } from './pinyin'
import { parseFileName } from './filename'

import {
  confidenceFromScore,
  lookupByCrc,
  matchByFileName,
  type MatchContext,
  type MatchInput,
  type MatchSource,
  type TitleSuggestion,
  CUSTOM_TITLE_PREFIX,
  encodeCustomTitleId,
  resolveTitleId,
  titleIdForUserTitle,
} from './match-core'

/** 匹配来源。crc/learned 属于精确命中，filename 是猜的，fallback 是没猜出来。 */
export type { MatchSource, MatchInput, MatchContext, TitleSuggestion }

/** 自定义标题前缀，导出供其它模块（如导入管线）复用。 */
export {
  CUSTOM_TITLE_PREFIX,
  encodeCustomTitleId,
  resolveTitleId,
  titleIdForUserTitle,
  matchByFileName,
}

export interface MatchOutcome {
  detected: DetectedMeta
  source: MatchSource
  /** 0~1 的原始相似度，精确命中恒为 1 */
  score: number
  /** 文件名模糊匹配时的备选项（Top-N，已按分数降序），精确命中时为空 */
  suggestions: TitleSuggestion[]
}

/* ------------------------------ DetectedMeta ----------------------------- */

interface MetaContext {
  region: Region
  year: number | null
  fallbackTitle: string
}

function metaFromEntry(
  entry: TitleEntry,
  ctx: MetaContext,
  confidence: MatchConfidence,
): DetectedMeta {
  return {
    title: entry.title,
    titleAlias: entry.cn,
    year: entry.year ?? ctx.year,
    categories: [...entry.categories],
    developer: entry.developer,
    publisher: entry.publisher,
    players: entry.players,
    region: ctx.region,
    description: null,
    confidence,
    matchedTitleId: entry.id.startsWith(CUSTOM_TITLE_PREFIX) ? null : entry.id,
  }
}

function metaFromFileName(ctx: MetaContext): DetectedMeta {
  return {
    title: ctx.fallbackTitle,
    titleAlias: hasCjk(ctx.fallbackTitle) ? ctx.fallbackTitle : null,
    year: ctx.year,
    categories: [],
    developer: null,
    publisher: null,
    players: null,
    region: ctx.region,
    description: null,
    confidence: 'none',
    matchedTitleId: null,
  }
}

/* -------------------------------- 主入口 -------------------------------- */

/** 一次性把自学习表读进内存，供整批导入复用 */
export async function createMatchContext(): Promise<MatchContext> {
  const rows = await crcLearnDao.getAll().catch(() => [] as CrcLearnRow[])
  return { learned: new Map(rows.map((row) => [row.crc32, row])) }
}

/**
 * 识别单个 ROM。ctx 省略时会自己查库（单文件场景方便），
 *  ̄批量导入请先 createMatchContext 再传进来。
 */
export async function matchRom(input: MatchInput, ctx?: MatchContext): Promise<MatchOutcome> {
  const parsed = parseFileName(input.fileName)
  const fallbackTitle = parsed.title.trim() || input.fileName
  const metaCtx: MetaContext = {
    region: parsed.region,
    year: parsed.year,
    fallbackTitle,
  }

  const crcs = Array.from(new Set(input.crcs.map((crc) => crc.toLowerCase()).filter(Boolean)))

  // 1. 内置库 CRC
  for (const crc of crcs) {
    const entry = lookupByCrc(crc)
    if (entry) {
      return {
        detected: metaFromEntry(entry, metaCtx, 'exact'),
        source: 'crc',
        score: 1,
        suggestions: [],
      }
    }
  }

  // 2. 自学习：用户确认过的，比任何猜测都可信
  // 命中即返回（continue/return），属于「首个命中」语义，刻意串行而非并行。
  /* eslint-disable eslint/no-await-in-loop */
  for (const crc of crcs) {
    const row = ctx ? ctx.learned.get(crc) : await crcLearnDao.get(crc).catch(() => undefined)
    if (!row) continue
    const entry = resolveTitleId(row.titleId)
    if (!entry) continue
    return {
      detected: metaFromEntry(entry, metaCtx, 'exact'),
      source: 'learned',
      score: 1,
      suggestions: [],
    }
  }
  /* eslint-enable eslint/no-await-in-loop */

  // 3. 文件名模糊匹配
  const suggestions = matchByFileName(input.fileName, 5)
  const top = suggestions[0]
  if (top && top.score >= 0.62) {
    return {
      detected: metaFromEntry(top.entry, metaCtx, confidenceFromScore(top.score)),
      source: 'filename',
      score: top.score,
      suggestions,
    }
  }

  // 4. 兜底
  return {
    detected: metaFromFileName(metaCtx),
    source: 'fallback',
    score: 0,
    suggestions,
  }
}

/**
 * 游戏详情页「重新识别」：已有 RomInfo + 文件名，重跑匹配管线覆盖 detected。
 * 不传 ctx，单文件场景直接查库，省去调用方维护上下文。
 */
export async function reidentify(rom: RomInfo, fileName: string): Promise<DetectedMeta> {
  const outcome = await matchRom({ fileName, crcs: [rom.crc32] })
  return outcome.detected
}
