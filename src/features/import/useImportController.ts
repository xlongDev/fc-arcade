import { useCallback, useMemo, useRef, useState } from 'react'

import { getStorageUsage, requestPersistence } from '@/data'
import { commitImport, importFiles } from '@/metadata'
import { notifyStorageChanged } from '@/features/common/lib/storageEvents'
import { filterRomFiles } from '@/features/common/lib/romFiles'
import { formatBytes } from '@/lib/format'
import type { ImportCandidate, ImportProgress, ImportResult, UserOverrides } from '@/types/game'

export type ImportPhase = 'idle' | 'parsing' | 'review' | 'committing' | 'done'

/** 只在首次导入时申请一次持久化存储，避免反复弹权限提示 */
const PERSIST_ASKED_KEY = 'fc-arcade-persistence-asked'

export interface ImportStats {
  total: number
  selectedCount: number
  duplicateCount: number
  failedCount: number
  selectedBytes: number
}

export interface ImportController {
  phase: ImportPhase
  progress: ImportProgress | null
  candidates: ImportCandidate[]
  result: ImportResult | null
  error: string | null
  storageWarning: string | null
  stats: ImportStats
  start: (files: File[]) => Promise<void>
  commit: () => Promise<void>
  reset: () => void
  toggle: (tempId: string) => void
  toggleAll: (next: boolean) => void
  patchOverrides: (tempId: string, patch: UserOverrides) => void
}

function normalize(list: ImportCandidate[]): ImportCandidate[] {
  return list.map((item) => ({
    ...item,
    // 解析失败或与库内重复的条目默认不勾选，用户可手动打开
    selected: item.error === null && item.duplicateOf === null ? item.selected : false,
  }))
}

export function useImportController(): ImportController {
  const [phase, setPhase] = useState<ImportPhase>('idle')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const runIdRef = useRef(0)

  const reset = useCallback(() => {
    runIdRef.current += 1
    setPhase('idle')
    setProgress(null)
    setCandidates([])
    setResult(null)
    setError(null)
    setStorageWarning(null)
  }, [])

  const start = useCallback(async (files: File[]) => {
    const roms = filterRomFiles(files)
    runIdRef.current += 1
    const runId = runIdRef.current

    setResult(null)
    setStorageWarning(null)

    if (roms.length === 0) {
      setCandidates([])
      setProgress(null)
      setPhase('review')
      setError('没有找到可导入的文件。支持 .nes / .fds / .unf / .unif / .zip。')
      return
    }

    setError(null)
    setCandidates([])
    setPhase('parsing')
    setProgress({ stage: 'reading', total: roms.length, processed: 0, currentFile: null })

    try {
      const parsed = await importFiles(roms, (next: ImportProgress) => {
        if (runIdRef.current === runId) setProgress(next)
      })
      if (runIdRef.current !== runId) return
      setCandidates(normalize(parsed))
      setPhase('review')
    } catch (cause) {
      if (runIdRef.current !== runId) return
      console.error('[fc-arcade] 解析 ROM 失败', cause)
      setError(cause instanceof Error ? cause.message : '解析文件时发生未知错误')
      setPhase('review')
    }
  }, [])

  const toggle = useCallback((tempId: string) => {
    setCandidates((prev) =>
      prev.map((item) =>
        item.tempId === tempId && item.error === null
          ? { ...item, selected: !item.selected }
          : item,
      ),
    )
  }, [])

  const toggleAll = useCallback((next: boolean) => {
    setCandidates((prev) =>
      prev.map((item) => (item.error === null ? { ...item, selected: next } : item)),
    )
  }, [])

  const patchOverrides = useCallback((tempId: string, patch: UserOverrides) => {
    setCandidates((prev) =>
      prev.map((item) =>
        item.tempId === tempId ? { ...item, overrides: { ...item.overrides, ...patch } } : item,
      ),
    )
  }, [])

  const stats = useMemo<ImportStats>(() => {
    let selectedCount = 0
    let duplicateCount = 0
    let failedCount = 0
    let selectedBytes = 0
    for (const item of candidates) {
      if (item.error !== null) failedCount += 1
      else if (item.duplicateOf !== null) duplicateCount += 1
      if (item.selected) {
        selectedCount += 1
        selectedBytes += item.fileSize
      }
    }
    return { total: candidates.length, selectedCount, duplicateCount, failedCount, selectedBytes }
  }, [candidates])

  const commit = useCallback(async () => {
    const picked = candidates.filter((item) => item.selected && item.error === null)
    if (picked.length === 0) return

    setPhase('committing')
    setError(null)
    setStorageWarning(null)

    try {
      if (localStorage.getItem(PERSIST_ASKED_KEY) === null) {
        localStorage.setItem(PERSIST_ASKED_KEY, '1')
        await requestPersistence().catch(() => false)
      }

      const needed = picked.reduce((sum, item) => sum + item.fileSize, 0)
      const usage = await getStorageUsage().catch(() => null)
      if (usage && usage.quota > 0) {
        const free = usage.quota - usage.usage
        if (needed > free) {
          setStorageWarning(
            `剩余空间约 ${formatBytes(free)}，本次需要 ${formatBytes(needed)}，可能写入失败。建议先清理部分游戏。`,
          )
        }
      }

      const done = await commitImport(picked)
      setResult(done)
      setPhase('done')
      notifyStorageChanged()
    } catch (cause) {
      console.error('[fc-arcade] 写入游戏库失败', cause)
      setError(cause instanceof Error ? cause.message : '写入游戏库时发生未知错误')
      setPhase('review')
    }
  }, [candidates])

  return {
    phase,
    progress,
    candidates,
    result,
    error,
    storageWarning,
    stats,
    start,
    commit,
    reset,
    toggle,
    toggleAll,
    patchOverrides,
  }
}
