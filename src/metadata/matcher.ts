/**
 * ROM 识别匹配器：多信号融合，按可信度从高到低依次尝试。
 *
 *   1. CRC32 精确匹配   —— 内置库里带 crcs 的条目（目前为空，预留给未来的数据包）
 *   2. CRC 自学习命中   —— 用户上次手工纠正过的 CRC → 标题，可信度等同精确匹配
 *   3. 文件名模糊匹配   —— Dice 系数 + 拼音首字母，扛脏文件名
 *   4. 兜底             —— 用清洗后的文件名当标题，标记为「未识别」
 *
 * 输出永远带 source 与 score，导入向导据此决定提示强度。
 */
import { crcLearnDao } from '@/data'
import type { CrcLearnRow } from '@/types/storage'
import type { DetectedMeta, MatchConfidence, Region, RomInfo, TitleEntry } from '@/types/game'

import { parseFileName } from './filename'
import { NES_TITLES, findTitleById } from './nes-titles'
import { hasCjk, pinyinInitials } from './pinyin'
import { diceCoefficient, normalizeTitle } from './text'

/** 匹配来源。crc/learned 属于精确命中，filename 是猜的，fallback 是没猜出来。 */
export type MatchSource = 'crc' | 'learned' | 'filename' | 'fallback'

export interface TitleSuggestion {
  entry: TitleEntry
  /** 0~1，越大越像 */
  score: number
}

export interface MatchInput {
  fileName: string
  /**
   * 待查的 CRC32 列表。iNES 文件请同时给「去掉 16 字节头」与「整文件」两种，
   * 任一命中即算精确匹配——不同来源的转储对 CRC 的算法约定不一致。
   */
  crcs: readonly string[]
}

export interface MatchOutcome {
  detected: DetectedMeta
  source: MatchSource
  /** 0~1 的原始相似度，精确命中恒为 1 */
  score: number
  /** 文件名模糊匹配时的备选项（Top-N，已按分数降序），精确命中时为空 */
  suggestions: TitleSuggestion[]
}

/**
 * 批量匹配时复用的上下文：一次性把自学习表读进内存，
 * 避免每个文件都去 IndexedDB 里往返一趟。
 */
export interface MatchContext {
  learned: ReadonlyMap<string, CrcLearnRow>
}

/* ------------------------------ 置信度分级 ------------------------------ */

/** 归一化标题完全一致或仅差极少字符 */
const SCORE_HIGH = 0.95
/** 大概率是同一个游戏，但存在版本 / 副标题差异 */
const SCORE_MEDIUM = 0.8
/** 沾边，需要用户核对 */
const SCORE_LOW = 0.62

function confidenceFromScore(score: number): MatchConfidence {
  if (score >= SCORE_HIGH) return 'high'
  if (score >= SCORE_MEDIUM) return 'medium'
  if (score >= SCORE_LOW) return 'low'
  return 'none'
}

/* ---------------------------- 自定义标题编码 ---------------------------- */

/**
 * 自学习表的 titleId 只能是字符串。用户手打的标题不在内置库里时，
 * 用这个前缀把标题本身编码进 id，保证「改过一次下次还认得」对任意标题都成立。
 */
export const CUSTOM_TITLE_PREFIX = 'custom:'

export function encodeCustomTitleId(title: string): string {
  return `${CUSTOM_TITLE_PREFIX}${title.trim()}`
}

/** titleId → 标题库条目。custom: 开头的合成一个只有标题的条目。 */
export function resolveTitleId(titleId: string): TitleEntry | null {
  if (titleId.startsWith(CUSTOM_TITLE_PREFIX)) {
    const title = titleId.slice(CUSTOM_TITLE_PREFIX.length).trim()
    if (!title) return null
    return {
      id: titleId,
      title,
      aliases: [],
      cn: hasCjk(title) ? title : null,
      year: null,
      categories: [],
      developer: null,
      publisher: null,
      players: null,
    }
  }
  return findTitleById(titleId) ?? null
}

/* ------------------------------- 索引构建 ------------------------------- */

interface NameVariant {
  norm: string
  /** 归一化标题里出现的数字，作品编号靠它区分 */
  numbers: string[]
  /**
   * 派生变体（去括号 / 去副标题）的权重折扣。
   * 「Batman」同时命中「Batman: The Video Game」和「Batman: Return of the Joker」的主名，
   * 折一点分保证完整标题的精确命中永远排在派生命中前面。
   */
  weight: number
}

interface IndexedEntry {
  entry: TitleEntry
  /** 标题 / 别名 / 中文名 / 去副标题后的主名，归一化去重 */
  variants: NameVariant[]
  /** 中文名的拼音首字母，没有中文名则为空串 */
  initials: string
  /** 条目自带的区域标记（标题里写着 (Japan) 之类） */
  region: Region | null
}

let indexCache: IndexedEntry[] | null = null
let crcIndexCache: Map<string, TitleEntry> | null = null

const PARENS = /\s*[([][^)\]]*[)\]]\s*/g
/** 副标题分隔符：「Zelda II: The Adventure of Link」的主名部分单独作为一个变体 */
const SUBTITLE_SPLIT = /[:：~]|\s-\s/
const DERIVED_WEIGHT = 0.97

function numbersIn(norm: string): string[] {
  return norm.match(/\d+/g) ?? []
}

function detectEntryRegion(title: string): Region | null {
  const lower = title.toLowerCase()
  if (lower.includes('(japan)') || lower.includes('(jp)')) return 'JP'
  if (lower.includes('(usa)') || lower.includes('(us)')) return 'US'
  if (lower.includes('(europe)')) return 'EU'
  if (lower.includes('(china)') || lower.includes('(taiwan)')) return 'CN'
  return null
}

function buildIndex(): IndexedEntry[] {
  if (indexCache) return indexCache
  const list: IndexedEntry[] = []
  for (const entry of NES_TITLES) {
    const raw: Array<[string, number]> = [
      [entry.title, 1],
      [entry.title.replace(PARENS, ' '), DERIVED_WEIGHT],
    ]
    for (const alias of entry.aliases) raw.push([alias, 1])
    if (entry.cn) raw.push([entry.cn, 1])
    const heads: Array<[string, number]> = []
    for (const [name] of raw) {
      const head = name.split(SUBTITLE_SPLIT)[0]
      if (head && head.length >= 3 && head !== name) heads.push([head, DERIVED_WEIGHT])
    }
    raw.push(...heads)
    const variants: NameVariant[] = []
    for (const [name, weight] of raw) {
      const norm = normalizeTitle(name)
      if (norm && !variants.some((v) => v.norm === norm)) {
        variants.push({ norm, numbers: numbersIn(norm), weight })
      }
    }
    list.push({
      entry,
      variants,
      initials: entry.cn ? pinyinInitials(entry.cn) : '',
      region: detectEntryRegion(entry.title),
    })
  }
  indexCache = list
  return list
}

function buildCrcIndex(): Map<string, TitleEntry> {
  if (crcIndexCache) return crcIndexCache
  const map = new Map<string, TitleEntry>()
  for (const entry of NES_TITLES) {
    for (const crc of entry.crcs ?? []) {
      map.set(crc.toLowerCase(), entry)
    }
  }
  crcIndexCache = map
  return map
}

/* ------------------------------ 文件名清洗 ------------------------------ */

/**
 * 常见的「非标题」词。只在长度 ≥ 2 时才剔除：单字母区域码（U / J / E）
 * 基本都写在括号里，已由 parseFileName 处理掉，在这里剔反而会误伤
 * 「U.N. Squadron」这类真标题。
 */
const NOISE_TOKENS: ReadonlySet<string> = new Set([
  'usa', 'us', 'jpn', 'jap', 'japan', 'japanese', 'europe', 'eur', 'euro', 'pal', 'ntsc',
  'china', 'chn', 'chs', 'cht', 'chinese', 'taiwan', 'korea', 'kor', 'asia', 'america',
  'unl', 'unlicensed', 'pirate', 'hack', 'hacked', 'proto', 'prototype', 'beta', 'demo',
  'sample', 'aftermarket', 'fixed', 'verified', 'dump', 'dumped', 'trainer', 'trained',
  'translated', 'translation', 'eng', 'english', 'multi', 'final', 'complete',
  'rom', 'nes', 'fds', 'unif', 'famicom', 'fami', 'nintendo',
  '汉化', '汉化版', '中文', '中文版', '简体', '繁体', '完美版', '修改版', '珍藏版',
])

const NOISE_PATTERNS: readonly RegExp[] = [
  /^rev[\s._-]?[0-9a-z]$/,
  /^v\d+(\.\d+)*$/,
  /^prg\d$/,
  /^disk\d$/,
  /^\d{4}$/,
]

function isNoiseToken(token: string): boolean {
  if (token.length < 2) return false
  if (NOISE_TOKENS.has(token)) return true
  return NOISE_PATTERNS.some((re) => re.test(token))
}

const VERSION_TOKEN = /^v\d+$/
const SHORT_NUMBER = /^\d{1,2}$/

/**
 * 去掉区域 / 版本这类噪声词。全被判成噪声时退回原串，
 * 避免「usa.nes」这种极端文件名被清成空。
 */
function stripNoise(title: string): string {
  const tokens = title.toLowerCase().split(/[\s_\-+]+/).filter(Boolean)
  const kept: string[] = []
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (!isNoiseToken(token)) {
      kept.push(token)
      continue
    }
    // 'v1.0' 被上游拆成了 'v1' + '0'，跟着版本号的零头也一并丢掉，
    // 否则残留的数字会把「Double Dragon 2」误导成「Double Dragon 20」
    if (VERSION_TOKEN.test(token) && i + 1 < tokens.length && SHORT_NUMBER.test(tokens[i + 1])) {
      i += 1
    }
  }
  if (kept.length === 0) return title
  return kept.join(' ')
}

/* -------------------------------- 相似度 -------------------------------- */

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const dice = diceCoefficient(a, b)
  // 「Rockman 2」vs「Rockman 2 Dr. Wily no Nazo」这类真子串关系 Dice 会偏低，给个下限。
  // 下限随长度比例缩放：子串占得越满越可信，这样「Mega Man 2」能压过「Mega Man」。
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return Math.max(dice, 0.55 + 0.35 * (shorter.length / longer.length))
  }
  return dice
}

const LATIN_ONLY = /^[a-z0-9]+$/

/**
 * 作品编号修正。标题里的数字是强信号：「Double Dragon 2」和「Double Dragon」
 * 只差一个字符，Dice 几乎分不开，但它们是两个游戏。
 */
function numberAdjust(query: readonly string[], variant: readonly string[]): number {
  if (query.length === 0 && variant.length === 0) return 0
  if (query.length === 0) return -0.1
  if (variant.length === 0) return -0.15
  return query.some((n) => variant.includes(n)) ? 0.05 : -0.18
}

function scoreEntry(indexed: IndexedEntry, queries: readonly QueryForm[], region: Region): number {
  let best = 0
  for (const { norm: query, numbers } of queries) {
    for (const variant of indexed.variants) {
      const score =
        similarity(query, variant.norm) * variant.weight + numberAdjust(numbers, variant.numbers)
      if (score > best) best = score
    }
    // 纯拉丁字母的短查询有可能是拼音首字母缩写：hdl → 魂斗罗
    if (indexed.initials.length >= 3 && query.length >= 3 && LATIN_ONLY.test(query)) {
      if (query === indexed.initials) best = Math.max(best, 0.9)
    }
  }
  if (best <= 0) return 0

  // 区域亲和：文件名标了 (J)，条目标题里写着 (Japan)，多半就是它
  if (indexed.region !== null && region !== 'Unknown') {
    best += indexed.region === region ? 0.06 : -0.05
  }
  return Math.min(1, Math.max(0, best))
}

interface QueryForm {
  norm: string
  numbers: string[]
}

/**
 * 纯文件名模糊匹配，返回 Top-N 备选。不碰数据库，可以在任何地方同步调用。
 */
export function matchByFileName(fileName: string, limit = 5): TitleSuggestion[] {
  const parsed = parseFileName(fileName)
  const rawNorm = normalizeTitle(parsed.title)
  const cleanNorm = normalizeTitle(stripNoise(parsed.title))
  // 原串和去噪串都参与打分取最大值：
  // 「Devil World」不会被「world」当噪声误杀，「SuperMarioBros_USA_rev1」也能清干净
  const forms = rawNorm === cleanNorm ? [rawNorm] : [rawNorm, cleanNorm]
  if (forms.every((form) => form.length < 2)) return []
  const queries: QueryForm[] = forms.map((norm) => ({ norm, numbers: numbersIn(norm) }))

  const scored: TitleSuggestion[] = []
  for (const indexed of buildIndex()) {
    const score = scoreEntry(indexed, queries, parsed.region)
    if (score >= SCORE_LOW) scored.push({ entry: indexed.entry, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, Math.max(0, limit))
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
 * 批量导入请先 createMatchContext 再传进来。
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
  const crcIndex = buildCrcIndex()
  for (const crc of crcs) {
    const entry = crcIndex.get(crc)
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
  if (top && top.score >= SCORE_LOW) {
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

/**
 * 用户手打的标题反查内置库。写自学习表时用：能对上库里的条目就存条目 id，
 * 对不上才退化成 custom: 编码。
 */
export function titleIdForUserTitle(title: string): string {
  const norm = normalizeTitle(title)
  if (norm.length >= 2) {
    for (const indexed of buildIndex()) {
      if (indexed.variants.some((variant) => variant.norm === norm)) return indexed.entry.id
    }
  }
  return encodeCustomTitleId(title)
}
