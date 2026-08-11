import { useCallback, useEffect, useMemo, useState } from 'react'

import { gameDao, mergeMeta } from '@/data'
import { notifyLibraryChanged } from '@/features/common/lib/storageEvents'
import type { DetectedMeta, GameRecord, UserOverrides } from '@/types/game'

/** 详情页可编辑的字段集合，与 UserOverrides 的键一一对应，但值都是「实际生效值」而非 undefined */
export type EditableMeta = Pick<
  DetectedMeta,
  | 'title'
  | 'titleAlias'
  | 'year'
  | 'categories'
  | 'developer'
  | 'publisher'
  | 'players'
  | 'region'
  | 'description'
>

function toDraft(meta: DetectedMeta): EditableMeta {
  return {
    title: meta.title,
    titleAlias: meta.titleAlias,
    year: meta.year,
    categories: [...meta.categories],
    developer: meta.developer,
    publisher: meta.publisher,
    players: meta.players,
    region: meta.region,
    description: meta.description,
  }
}

function sameCategories(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

/**
 * 把草稿与 detected 做逐字段比对，只有真正不同的字段才写进 overrides。
 * 这样用户把值改回识别结果时，「已编辑」标记会自动消失，重新识别也能重新接管该字段。
 */
function diffOverrides(detected: DetectedMeta, draft: EditableMeta): UserOverrides {
  const next: UserOverrides = {}
  if (draft.title !== detected.title) next.title = draft.title
  if (draft.titleAlias !== detected.titleAlias) next.titleAlias = draft.titleAlias
  if (draft.year !== detected.year) next.year = draft.year
  if (!sameCategories(draft.categories, detected.categories)) next.categories = draft.categories
  if (draft.developer !== detected.developer) next.developer = draft.developer
  if (draft.publisher !== detected.publisher) next.publisher = draft.publisher
  if (draft.players !== detected.players) next.players = draft.players
  if (draft.region !== detected.region) next.region = draft.region
  if (draft.description !== detected.description) next.description = draft.description
  return next
}

export interface GameEditor {
  record: GameRecord | null
  loading: boolean
  saving: boolean
  draft: EditableMeta | null
  /** 相对已落库的 overrides 是否有未保存改动 */
  dirty: boolean
  /** 当前草稿相对识别结果被改过的字段数 */
  editedCount: number
  patch: (partial: Partial<EditableMeta>) => void
  /** 丢弃未保存改动，回到已落库状态 */
  revert: () => void
  /** 清空全部手动修改，完全回到识别结果 */
  resetToDetected: () => void
  save: () => Promise<boolean>
  /** 外部（重新识别 / 换封面）改动落库后重新拉取记录 */
  reload: () => void
}

/** 详情页的元数据编辑器。编辑结果一律写进 overrides，detected 原样保留。 */
export function useGameEditor(gameId: string | null): GameEditor {
  const [record, setRecord] = useState<GameRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<EditableMeta | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (gameId === null) {
      setRecord(null)
      setDraft(null)
      return
    }
    let alive = true
    setLoading(true)
    void gameDao
      .get(gameId)
      .then((found) => {
        if (!alive) return
        setRecord(found ?? null)
        setDraft(found ? toDraft(mergeMeta(found.detected, found.overrides)) : null)
      })
      .catch((cause: unknown) => {
        console.error('[fc-arcade] 读取游戏记录失败', cause)
        if (alive) setRecord(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [gameId, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  const patch = useCallback((partial: Partial<EditableMeta>) => {
    setDraft((prev) => (prev === null ? prev : { ...prev, ...partial }))
  }, [])

  const revert = useCallback(() => {
    setDraft(record ? toDraft(mergeMeta(record.detected, record.overrides)) : null)
  }, [record])

  const resetToDetected = useCallback(() => {
    setDraft(record ? toDraft(record.detected) : null)
  }, [record])

  const pendingOverrides = useMemo(
    () => (record && draft ? diffOverrides(record.detected, draft) : null),
    [record, draft],
  )

  const dirty = useMemo(() => {
    if (!record || !pendingOverrides) return false
    const current = record.overrides
    const keys = new Set([...Object.keys(current), ...Object.keys(pendingOverrides)])
    for (const key of keys) {
      const a = current[key as keyof UserOverrides]
      const b = pendingOverrides[key as keyof UserOverrides]
      if (Array.isArray(a) && Array.isArray(b)) {
        if (!sameCategories(a, b)) return true
        continue
      }
      if (a !== b) return true
    }
    return false
  }, [record, pendingOverrides])

  const editedCount = pendingOverrides ? Object.keys(pendingOverrides).length : 0

  const save = useCallback(async (): Promise<boolean> => {
    if (!record || !pendingOverrides) return false
    setSaving(true)
    try {
      await gameDao.update(record.id, { overrides: pendingOverrides })
      setRecord({ ...record, overrides: pendingOverrides })
      notifyLibraryChanged()
      return true
    } catch (cause) {
      console.error('[fc-arcade] 保存游戏元数据失败', cause)
      return false
    } finally {
      setSaving(false)
    }
  }, [record, pendingOverrides])

  return {
    record,
    loading,
    saving,
    draft,
    dirty,
    editedCount,
    patch,
    revert,
    resetToDetected,
    save,
    reload,
  }
}
