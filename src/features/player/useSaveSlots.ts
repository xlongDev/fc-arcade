import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import { useToast } from '@/components/ui'
import { saveStateDao } from '@/data'
import { notifyStorageChanged } from '@/features/common/lib/storageEvents'
import { uid } from '@/lib/id'
import { useSettingsStore } from '@/store'
import type { EmulatorAdapter } from '@/types/emulator'
import type { SaveSlot, SaveStateRow } from '@/types/storage'

export function slotLabel(slot: SaveSlot): string {
  return slot === 'auto' ? '自动存档' : `槽位 ${slot + 1}`
}

export interface SaveSlots {
  rows: ReadonlyMap<SaveSlot, SaveStateRow>
  busySlot: SaveSlot | null
  save: (slot: SaveSlot) => Promise<void>
  load: (slot: SaveSlot) => Promise<void>
  remove: (slot: SaveSlot) => Promise<void>
  refresh: () => void
}

interface Options {
  gameId: string | null
  adapterRef: RefObject<EmulatorAdapter | null>
}

/** 10 个手动槽位 + 1 个自动槽位的读写。自动存档按设置的间隔静默执行。 */
export function useSaveSlots({ gameId, adapterRef }: Options): SaveSlots {
  const [rows, setRows] = useState<ReadonlyMap<SaveSlot, SaveStateRow>>(new Map())
  const [busySlot, setBusySlot] = useState<SaveSlot | null>(null)
  const [version, setVersion] = useState(0)
  const { toast } = useToast()
  const autoSaveIntervalSec = useSettingsStore((s) => s.settings.autoSaveIntervalSec)

  useEffect(() => {
    if (gameId === null) {
      setRows(new Map())
      return
    }
    let alive = true
    void saveStateDao
      .listByGame(gameId)
      .then((found) => {
        if (!alive) return
        setRows(new Map(found.map((row) => [row.slot, row])))
      })
      .catch((cause: unknown) => console.error('[fc-arcade] 读取存档失败', cause))
    return () => {
      alive = false
    }
  }, [gameId, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  /** 写一个槽位。silent = 自动存档，不弹 toast、不打断游戏。 */
  const writeSlot = useCallback(
    async (slot: SaveSlot, silent: boolean) => {
      const adapter = adapterRef.current
      if (!adapter || gameId === null) return
      if (!silent) setBusySlot(slot)
      try {
        const payload = await adapter.saveState()
        const thumb = await adapter.screenshot({ scale: 1, type: 'image/webp' }).catch(() => null)
        const row: SaveStateRow = {
          id: uid('save'),
          gameId,
          slot,
          core: payload.core,
          version: payload.version,
          blob: new Blob([new Uint8Array(payload.data)]),
          thumb,
          label: null,
          createdAt: payload.createdAt,
        }
        await saveStateDao.put(row)
        setRows((prev) => new Map(prev).set(slot, row))
        notifyStorageChanged()
        if (!silent) toast({ variant: 'success', title: `已保存到${slotLabel(slot)}` })
      } catch (cause) {
        console.error('[fc-arcade] 保存进度失败', cause)
        if (!silent) toast({ variant: 'error', title: '保存进度失败' })
      } finally {
        if (!silent) setBusySlot(null)
      }
    },
    [adapterRef, gameId, toast],
  )

  const save = useCallback((slot: SaveSlot) => writeSlot(slot, false), [writeSlot])

  const load = useCallback(
    async (slot: SaveSlot) => {
      const adapter = adapterRef.current
      const row = rows.get(slot)
      if (!adapter || !row) {
        toast({ variant: 'warning', title: `${slotLabel(slot)}还是空的` })
        return
      }
      if (row.core !== adapter.core) {
        toast({
          variant: 'error',
          title: '存档内核不匹配',
          description: `这份进度由 ${row.core} 内核保存，当前内核是 ${adapter.core}，无法读取。`,
        })
        return
      }
      setBusySlot(slot)
      try {
        const buffer = await row.blob.arrayBuffer()
        await adapter.loadState({
          core: row.core,
          version: row.version,
          createdAt: row.createdAt,
          data: new Uint8Array(buffer),
        })
        toast({ variant: 'success', title: `已读取${slotLabel(slot)}` })
      } catch (cause) {
        console.error('[fc-arcade] 读取进度失败', cause)
        toast({ variant: 'error', title: '读取进度失败', description: '存档可能已损坏。' })
      } finally {
        setBusySlot(null)
      }
    },
    [adapterRef, rows, toast],
  )

  const remove = useCallback(
    async (slot: SaveSlot) => {
      const row = rows.get(slot)
      if (!row) return
      setBusySlot(slot)
      try {
        await saveStateDao.remove(row.id)
        setRows((prev) => {
          const next = new Map(prev)
          next.delete(slot)
          return next
        })
        notifyStorageChanged()
      } catch (cause) {
        console.error('[fc-arcade] 删除存档失败', cause)
        toast({ variant: 'error', title: '删除存档失败' })
      } finally {
        setBusySlot(null)
      }
    },
    [rows, toast],
  )

  // 自动存档。只在模拟器真正在跑的时候写，暂停时跳过。
  const writeRef = useRef(writeSlot)
  writeRef.current = writeSlot

  useEffect(() => {
    if (gameId === null || autoSaveIntervalSec <= 0) return
    const timer = window.setInterval(() => {
      if (adapterRef.current?.status !== 'running') return
      void writeRef.current('auto', true)
    }, autoSaveIntervalSec * 1000)
    return () => window.clearInterval(timer)
  }, [gameId, autoSaveIntervalSec, adapterRef])

  return { rows, busySlot, save, load, remove, refresh }
}
