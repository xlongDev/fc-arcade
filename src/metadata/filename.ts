/**
 * 文件名解析，同时兼容 GoodNES 与 No-Intro 两种命名约定。
 *
 * GoodNES：  Contra (U) [!].nes / Rockman 2 (J) [T+Chi_FlameCyclone].nes / Zelda (U) (PRG0) [!].nes
 * No-Intro： Contra (USA).nes / Legend of Zelda, The (USA) (Rev 1).nes / Batman (Europe).nes
 */
import type { Region } from '@/types/game'

import { restoreLeadingArticle } from './text'

export interface ParsedFileName {
  title: string
  year: number | null
  region: Region
  /** 归一化后的标记，如 verified / bad / translated-zh / rev:A / proto */
  flags: string[]
}

const EXTENSIONS = /\.(nes|fds|unf|unif|zip|bin|rom)$/i

/** GoodNES 单字母 / No-Intro 全称 → Region */
const REGION_TOKENS: Readonly<Record<string, Region>> = {
  u: 'US',
  usa: 'US',
  us: 'US',
  america: 'US',
  'north america': 'US',
  j: 'JP',
  jp: 'JP',
  jpn: 'JP',
  japan: 'JP',
  e: 'EU',
  eu: 'EU',
  eur: 'EU',
  europe: 'EU',
  pal: 'EU',
  uk: 'EU',
  f: 'EU',
  france: 'EU',
  g: 'EU',
  germany: 'EU',
  i: 'EU',
  italy: 'EU',
  s: 'EU',
  spain: 'EU',
  sw: 'EU',
  sweden: 'EU',
  nl: 'EU',
  netherlands: 'EU',
  c: 'CN',
  china: 'CN',
  chn: 'CN',
  chinese: 'CN',
  taiwan: 'CN',
  tw: 'CN',
  'hong kong': 'CN',
  w: 'World',
  world: 'World',
  ju: 'World',
  ue: 'World',
  je: 'World',
  uej: 'World',
  jue: 'World',
  a: 'World',
  asia: 'World',
  k: 'Unknown',
  korea: 'Unknown',
  unk: 'Unknown',
  unl: 'Unknown',
}

/** 多国家逗号列表，如 "USA, Europe" */
function resolveRegionToken(raw: string): Region | null {
  const token = raw.trim().toLowerCase()
  if (!token) return null
  const direct = REGION_TOKENS[token]
  if (direct) return direct
  if (token.includes(',')) {
    const parts = token
      .split(',')
      .map((p) => REGION_TOKENS[p.trim()])
      .filter((r): r is Region => Boolean(r))
    if (parts.length === 0) return null
    const unique = Array.from(new Set(parts))
    if (unique.length === 1) return unique[0]
    return 'World'
  }
  return null
}

/** GoodNES 方括号标记 → 归一化 flag */
function parseBracketFlag(raw: string): string | null {
  const token = raw.trim()
  if (!token) return null
  const lower = token.toLowerCase()
  if (lower === '!') return 'verified'
  if (lower === '!p') return 'verified-pending'
  if (/^b\d*$/.test(lower)) return 'bad'
  if (/^a\d*$/.test(lower)) return 'alternate'
  if (/^h\d*.*$/.test(lower) && lower.startsWith('h')) return 'hack'
  if (/^o\d*$/.test(lower)) return 'overdump'
  if (/^p\d*$/.test(lower)) return 'pirate'
  if (/^f\d*$/.test(lower)) return 'fixed'
  if (/^t[+-]/.test(lower)) {
    // [T+Chi]、[T-Chi_xxx]、[T+Eng1.0_yyy]
    const lang = /^t[+-]([a-z]+)/.exec(lower)?.[1] ?? ''
    if (lang.startsWith('chi')) return 'translated-zh'
    if (lang) return `translated-${lang}`
    return 'translated'
  }
  return `tag:${lower}`
}

/** 圆括号内容 → flag（不是区域也不是年份时） */
function parseParenFlag(raw: string): string | null {
  const token = raw.trim()
  if (!token) return null
  const lower = token.toLowerCase()
  const rev = /^rev\s*([0-9a-z]+)$/.exec(lower)
  if (rev) return `rev:${rev[1].toUpperCase()}`
  if (/^prg\s*\d$/.test(lower)) return lower.replace(/\s+/g, '')
  if (lower === 'unl' || lower === 'unlicensed') return 'unlicensed'
  if (lower === 'beta' || /^beta\s*\d+$/.test(lower)) return 'beta'
  if (lower === 'proto' || lower === 'prototype') return 'proto'
  if (lower === 'demo' || lower === 'sample') return 'demo'
  if (lower === 'aftermarket') return 'aftermarket'
  if (lower === 'pirate') return 'pirate'
  if (lower.includes('translat')) return 'translated'
  if (/^v\d+(\.\d+)*$/.test(lower)) return `version:${lower}`
  return `tag:${lower}`
}

const SEGMENT = /[([]([^)\]]*)[)\]]/g
const YEAR = /^(19[7-9]\d|20[0-2]\d)$/

/**
 * 拆出标题、年份、区域与标记。
 * 括号里的内容依次尝试识别成 年份 → 区域 → 标记，识别不了的保留成 tag:xxx，
 * 保证信息不丢失，UI 想展示原始标记也拿得到。
 */
export function parseFileName(fileName: string): ParsedFileName {
  const base = fileName
    .replace(/^.*[\\/]/, '')
    .replace(EXTENSIONS, '')
    .trim()

  let year: number | null = null
  let region: Region = 'Unknown'
  const flags: string[] = []

  for (const match of base.matchAll(SEGMENT)) {
    const inner = match[1] ?? ''
    const isBracket = match[0].startsWith('[')

    if (!isBracket && YEAR.test(inner.trim())) {
      if (year === null) year = Number(inner.trim())
      continue
    }

    if (!isBracket) {
      const resolved = resolveRegionToken(inner)
      if (resolved && region === 'Unknown') {
        region = resolved
        continue
      }
      if (resolved) continue
      const flag = parseParenFlag(inner)
      if (flag) flags.push(flag)
      continue
    }

    const flag = parseBracketFlag(inner)
    if (flag) flags.push(flag)
  }

  // 汉化版对中文用户来说就是「中文版」，比原始区域更有意义
  if (flags.includes('translated-zh')) region = 'CN'

  const title = restoreLeadingArticle(
    base
      .replace(SEGMENT, ' ')
      .replace(/[_.]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  )

  return {
    title: title || base,
    year,
    region,
    flags: Array.from(new Set(flags)),
  }
}
