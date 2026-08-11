/**
 * 封面 Blob → objectURL 的引用计数缓存。
 *
 * 封面墙一次能滚过上千张图，每次挂载都 createObjectURL 而不 revoke 会把内存吃穿；
 * 反过来一卸载就 revoke，来回滚动又会不停重读 IndexedDB。
 * 折中做法：引用计数为 0 的条目先进 LRU 闲置队列，超出上限才真正 revoke。
 */
import { coverDao } from '@/data'
import type { CoverRow } from '@/types/storage'

export type StoredCoverKind = CoverRow['kind']

interface CacheEntry {
  url: string
  kind: StoredCoverKind
  refs: number
}

/** 闲置条目的保留数量。按一屏最多 ~60 张封面估，留两三屏的回滚余量。 */
const IDLE_LIMIT = 160

const entries = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<CacheEntry | null>>()
/** 引用计数归零的 id，先进先出 */
const idle: string[] = []

const versions = new Map<string, number>()
const listeners = new Map<string, Set<() => void>>()

function dropIdle(gameId: string): void {
  const index = idle.indexOf(gameId)
  if (index !== -1) idle.splice(index, 1)
}

function evict(): void {
  while (idle.length > IDLE_LIMIT) {
    const gameId = idle.shift()
    if (gameId === undefined) return
    const entry = entries.get(gameId)
    if (!entry || entry.refs > 0) continue
    URL.revokeObjectURL(entry.url)
    entries.delete(gameId)
  }
}

async function loadEntry(gameId: string): Promise<CacheEntry | null> {
  try {
    const row = await coverDao.get(gameId)
    if (!row) return null
    const existing = entries.get(gameId)
    if (existing) return existing
    const entry: CacheEntry = { url: URL.createObjectURL(row.blob), kind: row.kind, refs: 0 }
    entries.set(gameId, entry)
    // 先记进闲置队列：万一请求方在 await 期间就卸载了，这条也能被回收
    idle.push(gameId)
    evict()
    return entry
  } catch (error) {
    console.error('[fc-arcade] 读取封面失败', error)
    return null
  } finally {
    pending.delete(gameId)
  }
}

export interface AcquiredCover {
  url: string
  kind: StoredCoverKind
}

/** 已在缓存里则同步返回，用于避免重新挂载时闪一下骨架屏 */
export function peekCover(gameId: string): AcquiredCover | null {
  const entry = entries.get(gameId)
  return entry ? { url: entry.url, kind: entry.kind } : null
}

/** 取用封面。调用方必须在卸载时配对调用 releaseCover。 */
export async function acquireCover(gameId: string): Promise<AcquiredCover | null> {
  const cached = entries.get(gameId)
  if (cached) {
    cached.refs += 1
    dropIdle(gameId)
    return { url: cached.url, kind: cached.kind }
  }

  let job = pending.get(gameId)
  if (!job) {
    job = loadEntry(gameId)
    pending.set(gameId, job)
  }
  const entry = await job
  if (!entry) return null
  // 可能在 await 期间被 invalidate 掉了，这时拿到的是已作废的 entry
  if (entries.get(gameId) !== entry) return null
  entry.refs += 1
  dropIdle(gameId)
  return { url: entry.url, kind: entry.kind }
}

export function releaseCover(gameId: string): void {
  const entry = entries.get(gameId)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  if (entry.refs > 0) return
  dropIdle(gameId)
  idle.push(gameId)
  evict()
}

/**
 * 封面被改写（自动截图、用户上传、删除）后调用，
 * 丢掉旧 URL 并通知所有正在显示它的组件重新取。
 */
export function invalidateCover(gameId: string): void {
  const entry = entries.get(gameId)
  if (entry) {
    URL.revokeObjectURL(entry.url)
    entries.delete(gameId)
    dropIdle(gameId)
  }
  pending.delete(gameId)
  versions.set(gameId, (versions.get(gameId) ?? 0) + 1)
  const set = listeners.get(gameId)
  if (!set) return
  for (const listener of set) listener()
}

/** 全部作废。清空数据、导入备份之后用。 */
export function invalidateAllCovers(): void {
  // 先快照 key，invalidateCover 会在遍历过程中删条目
  for (const gameId of Array.from(entries.keys())) invalidateCover(gameId)
}

export function getCoverVersion(gameId: string): number {
  return versions.get(gameId) ?? 0
}

export function subscribeCover(gameId: string, listener: () => void): () => void {
  let set = listeners.get(gameId)
  if (!set) {
    set = new Set()
    listeners.set(gameId, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(gameId)
  }
}
