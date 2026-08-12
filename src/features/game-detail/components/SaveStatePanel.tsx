import { useCallback, useEffect, useState } from 'react'

import { Button, EmptyState, Spinner, useToast } from '@/components/ui'
import { IconClock, IconTrash } from '@/components/icons'
import { saveStateDao } from '@/data'
import { BlobImage } from '@/features/common/components/BlobImage'
import { notifyStorageChanged } from '@/features/common/lib/storageEvents'
import { formatBytes, formatRelativeTime } from '@/lib/format'
import type { SaveStateRow } from '@/types/storage'
import { CORE_DISPLAY_NAME } from '@/types/emulator'

function slotLabel(row: SaveStateRow): string {
  if (row.slot === 'auto') return '自动存档'
  return `槽位 ${row.slot + 1}`
}

interface Props {
  gameId: string
}

/** 详情页的存档管理：只读列表 + 删除。存 / 读档在播放器里做。 */
export function SaveStatePanel({ gameId }: Props) {
  const [rows, setRows] = useState<SaveStateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const { toast } = useToast()

  const load = useCallback(() => {
    let alive = true
    setLoading(true)
    void saveStateDao
      .listByGame(gameId)
      .then((found) => {
        if (alive) setRows(found)
      })
      .catch((cause: unknown) => {
        console.error('[fc-arcade] 读取存档列表失败', cause)
        if (alive) setRows([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [gameId])

  useEffect(() => load(), [load])

  const removeOne = async (row: SaveStateRow) => {
    setRemoving(row.id)
    try {
      await saveStateDao.remove(row.id)
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      notifyStorageChanged()
      toast({ variant: 'success', title: `已删除${slotLabel(row)}` })
    } catch (cause) {
      console.error('[fc-arcade] 删除存档失败', cause)
      toast({ variant: 'error', title: '删除存档失败' })
    } finally {
      setRemoving(null)
    }
  }

  const removeAll = async () => {
    setRemoving('*')
    try {
      await saveStateDao.removeByGame(gameId)
      setRows([])
      notifyStorageChanged()
      toast({ variant: 'success', title: '已清空该游戏的全部存档' })
    } catch (cause) {
      console.error('[fc-arcade] 清空存档失败', cause)
      toast({ variant: 'error', title: '清空存档失败' })
    } finally {
      setRemoving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconClock size={28} />}
        title="还没有存档"
        description="在播放器里按 Shift + 1~9 可以随时把进度存进对应槽位。"
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-2.5"
          >
            <BlobImage
              blob={row.thumb}
              className="aspect-[256/240] w-20 shrink-0 rounded-xl border border-[var(--color-border)]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-text)]">
                {row.label ?? slotLabel(row)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">
                {formatRelativeTime(row.createdAt)} · {formatBytes(row.blob.size)} · {CORE_DISPLAY_NAME[row.core]}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              loading={removing === row.id}
              icon={<IconTrash size={14} />}
              onClick={() => void removeOne(row)}
            >
              删除
            </Button>
          </li>
        ))}
      </ul>

      <Button
        variant="ghost"
        size="sm"
        fullWidth
        loading={removing === '*'}
        onClick={() => void removeAll()}
      >
        清空全部存档（{rows.length} 个）
      </Button>
    </div>
  )
}
