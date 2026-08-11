/** 存储配额与持久化申请 */
import type { StorageUsage } from '@/types/storage'

import { db } from './db'

function getStorageManager(): StorageManager | undefined {
  if (typeof navigator === 'undefined') return undefined
  return 'storage' in navigator ? navigator.storage : undefined
}

/**
 * 配额来自 navigator.storage.estimate()（浏览器层面的总量，含 Cache Storage 等）；
 * breakdown 由各表 blob 尺寸求和估算，只覆盖本应用写入 IndexedDB 的大块数据，
 * 所以 breakdown 三项之和一般略小于 usage，这是预期行为。
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  const manager = getStorageManager()

  let usage = 0
  let quota = 0
  let persisted = false

  if (manager) {
    try {
      const estimate = await manager.estimate()
      usage = estimate.usage ?? 0
      quota = estimate.quota ?? 0
    } catch {
      // Safari 私密模式下会抛，忽略即可，走 breakdown 兜底
    }
    try {
      persisted = await manager.persisted()
    } catch {
      persisted = false
    }
  }

  const breakdown = { roms: 0, covers: 0, saveStates: 0 }

  await db.roms.each((row) => {
    breakdown.roms += row.size || row.blob.size
  })
  await db.covers.each((row) => {
    breakdown.covers += row.blob.size
  })
  await db.saveStates.each((row) => {
    breakdown.saveStates += row.blob.size + (row.thumb?.size ?? 0)
  })

  if (usage === 0) {
    usage = breakdown.roms + breakdown.covers + breakdown.saveStates
  }

  return { usage, quota, persisted, breakdown }
}

/**
 * 申请持久化存储，避免浏览器在磁盘紧张时清掉 IndexedDB。
 * 多数浏览器需要「已安装 PWA / 被加为书签 / 有足够互动」才会批准，返回 false 很正常。
 */
export async function requestPersistence(): Promise<boolean> {
  const manager = getStorageManager()
  if (!manager || typeof manager.persist !== 'function') return false
  try {
    if (typeof manager.persisted === 'function' && (await manager.persisted())) return true
    return await manager.persist()
  } catch {
    return false
  }
}
