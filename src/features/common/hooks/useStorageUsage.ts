import { useCallback, useEffect, useState } from 'react'

import { getStorageUsage } from '@/data'
import type { StorageUsage } from '@/types/storage'

import { onStorageChanged } from '../lib/storageEvents'

interface UseStorageUsageResult {
  usage: StorageUsage | null
  loading: boolean
  refresh: () => void
}

/** 读取存储用量，并在导入/删除后自动重算 */
export function useStorageUsage(): UseStorageUsageResult {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(true)

  const read = useCallback(() => {
    let cancelled = false
    setLoading(true)
    getStorageUsage()
      .then((next) => {
        if (!cancelled) setUsage(next)
      })
      .catch((error: unknown) => {
        console.warn('[fc-arcade] 读取存储用量失败', error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    const cancel = read()
    return cancel
    // tick 变化时重新读数
  }, [read, tick])

  useEffect(() => onStorageChanged(refresh), [refresh])

  return { usage, loading, refresh }
}
