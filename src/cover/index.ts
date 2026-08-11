/**
 * 程序化封面统一出口。
 * 其他模块一律 `import { GeneratedCover } from '@/cover'`，不要深入 import 子文件。
 */
export type { GeneratedCoverProps } from './GeneratedCover'
export { GeneratedCover } from './GeneratedCover'

export type { GameCoverResult } from './useGameCover'
export { useGameCover } from './useGameCover'

export type { AcquiredCover, StoredCoverKind } from './coverCache'
export { invalidateAllCovers, invalidateCover } from './coverCache'

export type { CoverPattern, CoverSeed } from './hash'
export { COVER_PATTERNS, coverInitials, deriveCover } from './hash'
