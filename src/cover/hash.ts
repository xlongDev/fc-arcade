/**
 * 程序化封面的确定性种子推导。
 *
 * 铁律：同一个游戏在任何设备、任何时刻渲染出的封面必须逐像素一致，
 * 所以这里只允许用 hash 派生的伪随机数，禁止 Math.random / Date.now。
 */
import { fnv1a } from '@/lib/id'

export const COVER_PATTERNS = ['blocks', 'stripes', 'checker', 'rings', 'stars', 'bricks'] as const

export type CoverPattern = (typeof COVER_PATTERNS)[number]

export interface CoverSeed {
  /** 参与 hash 的原始字符串，调试用 */
  key: string
  hash: number
  /** 主色相 0~359 */
  hue: number
  /** 副色相，与主色相成和谐夹角 */
  hueAlt: number
  /** 饱和度百分比 */
  sat: number
  /** 明度百分比（暗色底） */
  light: number
  pattern: CoverPattern
  /** 图案覆盖密度 0~1 */
  density: number
  /** 图案单元边长（在 240×180 的 viewBox 坐标系里） */
  cell: number
  /** 图案是否水平翻转，让同类图案之间也有区别 */
  flip: boolean
  /** 与主题强调色混合的比例（百分比），越大越贴近主题 */
  accentMix: number
}

/**
 * mulberry32。周期足够长、分布均匀、四行搞定，
 * 比 LCG 更适合拿来铺图案（低位不会出现明显周期）。
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length]
}

/** 相邻色相夹角候选：互补 / 三分 / 邻近，避免出现脏配色 */
const HUE_STEPS = [28, 42, 150, 186, 210, 320]

/**
 * 由稳定标识推导出整套封面参数。
 * 传 CRC32 最好（同一 ROM 换文件名封面不变），没有就传游戏 id 或标题。
 */
export function deriveCover(key: string): CoverSeed {
  const hash = fnv1a(key || 'fc-arcade')
  const rng = createRng(hash)
  const hue = Math.floor(rng() * 360)
  const step = pick(rng, HUE_STEPS)
  return {
    key,
    hash,
    hue,
    hueAlt: (hue + step) % 360,
    sat: 52 + Math.floor(rng() * 26),
    light: 16 + Math.floor(rng() * 12),
    pattern: pick(rng, COVER_PATTERNS),
    density: 0.18 + rng() * 0.24,
    // 只取能整除 240×180 的边长，图案不会在右下角被切半格
    cell: pick(rng, [15, 20, 30]),
    flip: rng() > 0.5,
    accentMix: 20 + Math.floor(rng() * 18),
  }
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/

/** 提取封面中央文字时跳过的常见虚词/助词，提升识别性（「火之鸟」→「火鸟」）。 */
const CJK_PARTICLES = new Set([
  '之', '的', '了', '和', '与', '在', '是', '为', '于', '以', '及', '而', '或', '但',
  '着', '过', '得', '地', '吧', '吗', '呢', '啊', '哦', '嗯', '啦', '哇', '呀', '呐',
])

/**
 * 封面中央叠印的字。
 * 中文跳过常见虚词后取前两个有效字（「火之鸟」→「火鸟」），
 * 英文取前两个单词首字母（「Super Mario Bros」→「SM」），单词只有一个时取前两个字母。
 */
export function coverInitials(title: string): string {
  const text = title.trim()
  if (text.length === 0) return '?'

  if (CJK.test(text[0])) {
    const chars = [...text].filter((c) => CJK.test(c) || /[0-9A-Za-z]/.test(c))
    const meaningful = chars.filter((c) => !CJK_PARTICLES.has(c))
    return meaningful.slice(0, 2).join('') || chars.slice(0, 2).join('') || text.slice(0, 2)
  }

  const words = text
    .split(/[\s_\-·:：.]+/)
    .map((w) => w.replace(/[^0-9A-Za-z\u3400-\u9fff]/g, ''))
    .filter(Boolean)

  if (words.length === 0) return text.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** 中央文字是否走中文字体栈 */
export function isCjkText(text: string): boolean {
  return CJK.test(text)
}
