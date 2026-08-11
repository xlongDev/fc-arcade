/**
 * 标题归一化与搜索文本构建。
 *
 * 这是一个**叶子模块**：只依赖 pinyin.ts，不依赖 @/data 与 @/metadata/index，
 * 因此 data 层可以安全地直接 import 它来重算 titleNorm / searchText，不会形成循环依赖。
 */
import { hasCjk, pinyinInitials } from './pinyin'

/** 罗马数字 → 阿拉伯数字。刻意不收 i / x：单独的 i、x 在英文标题里常是别的意思。 */
const ROMAN_NUMERALS: Readonly<Record<string, string>> = {
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  xi: '11',
  xii: '12',
}

/** 归一化时丢弃的冠词 */
const ARTICLES: ReadonlySet<string> = new Set(['the', 'a', 'an'])

const TOKEN_SPLIT = /[^0-9a-z\u3400-\u4dbf\u4e00-\u9fff]+/

/**
 * 标题归一化：全角转半角、去变音符号、转小写、去冠词、
 * 罗马数字转阿拉伯数字、去掉所有标点与空格。
 *
 * 'The Legend of Zelda II' → 'legendofzelda2'
 */
export function normalizeTitle(raw: string): string {
  if (!raw) return ''
  // NFKC 负责全角 → 半角、兼容字符归并；NFD + 去组合记号负责 é → e
  const plain = raw
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const tokens = plain.split(TOKEN_SPLIT).filter(Boolean)
  const kept: string[] = []
  for (const token of tokens) {
    if (ARTICLES.has(token)) continue
    kept.push(ROMAN_NUMERALS[token] ?? token)
  }
  // 整个标题都是冠词这种极端情况，退回不去冠词的结果，避免归一化成空串
  if (kept.length === 0) return tokens.join('')
  return kept.join('')
}

/** 把 'Legend of Zelda, The' 这类 No-Intro 后置冠词还原成 'The Legend of Zelda' */
export function restoreLeadingArticle(title: string): string {
  const match = /^(.*),\s*(The|A|An|Los|Las|Le|La|Les|Der|Die|Das|El)$/i.exec(title.trim())
  if (!match) return title
  return `${match[2]} ${match[1]}`.trim()
}

export interface SearchTextInput {
  title: string
  titleAlias: string | null
  fileName: string
  /** 标题库里的别名（日文罗马音 / 美版名 / 缩写） */
  aliases?: readonly string[]
}

/**
 * 预计算搜索文本。写入时算一次，搜索时只做 includes，避免每次输入都重算。
 * 内容 = 原标题 + 归一化标题 + 中文别名 + 中文别名的拼音首字母 + 库内别名 + 文件名。
 */
export function buildSearchText(input: SearchTextInput): string {
  const parts: string[] = []
  const push = (value: string | null | undefined): void => {
    if (!value) return
    const trimmed = value.trim()
    if (trimmed) parts.push(trimmed.toLowerCase())
  }

  push(input.title)
  push(normalizeTitle(input.title))
  push(input.titleAlias)
  if (input.titleAlias && hasCjk(input.titleAlias)) push(pinyinInitials(input.titleAlias))
  if (input.title && hasCjk(input.title)) push(pinyinInitials(input.title))
  for (const alias of input.aliases ?? []) {
    push(alias)
    if (hasCjk(alias)) push(pinyinInitials(alias))
  }
  push(input.fileName)

  return Array.from(new Set(parts)).join(' ')
}

/** Dice 系数（bigram）相似度，返回 0~1。用于标题模糊匹配。 */
export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0

  const bigrams = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2)
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1)
  }

  let hits = 0
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2)
    const count = bigrams.get(gram) ?? 0
    if (count > 0) {
      bigrams.set(gram, count - 1)
      hits += 1
    }
  }

  return (2 * hits) / (a.length - 1 + (b.length - 1))
}
