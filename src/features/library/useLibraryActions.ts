import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'

import { downloadSaveStatesByGame, gameDao } from '@/data'
import { useToast } from '@/components/ui'
import { notifyLibraryChanged } from '@/features/common/lib/storageEvents'
import { useLibraryStore } from '@/store'
import { displayTitle } from '@/features/common/lib/gameDisplay'
import type { GameView } from '@/types/game'

interface LibraryActionsResult {
  busy: boolean
  play: (game: GameView) => void
  toggleFavorite: (game: GameView) => Promise<void>
  favoriteMany: (ids: string[], favorite: boolean) => Promise<void>
  removeMany: (ids: string[]) => Promise<void>
  exportSaves: (game: GameView) => Promise<void>
}

/** 游戏库里所有会写库的动作。集中在这里，保证每次写完都发一次刷新广播。 */
export function useLibraryActions(): LibraryActionsResult {
  const navigate = useNavigate()
  const { toast } = useToast()
  const clearSelection = useLibraryStore((s) => s.clearSelection)
  const [busy, setBusy] = useState(false)

  const play = useCallback(
    (game: GameView) => {
      void navigate(`/play/${game.id}`)
    },
    [navigate],
  )

  const toggleFavorite = useCallback(
    async (game: GameView) => {
      try {
        await gameDao.update(game.id, { favorite: !game.favorite })
        notifyLibraryChanged()
      } catch (error) {
        console.error('[fc-arcade] 更新收藏状态失败', error)
        toast({ variant: 'error', title: '操作失败', description: '收藏状态没能保存。' })
      }
    },
    [toast],
  )

  const favoriteMany = useCallback(
    async (ids: string[], favorite: boolean) => {
      if (ids.length === 0) return
      setBusy(true)
      try {
        await Promise.all(ids.map((id) => gameDao.update(id, { favorite })))
        notifyLibraryChanged()
        clearSelection()
        toast({
          variant: 'success',
          title: favorite ? `已收藏 ${ids.length} 个游戏` : `已取消收藏 ${ids.length} 个游戏`,
        })
      } catch (error) {
        console.error('[fc-arcade] 批量收藏失败', error)
        toast({ variant: 'error', title: '批量操作失败' })
      } finally {
        setBusy(false)
      }
    },
    [clearSelection, toast],
  )

  const removeMany = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      setBusy(true)
      try {
        await gameDao.removeMany(ids)
        notifyLibraryChanged()
        clearSelection()
        toast({ variant: 'success', title: `已删除 ${ids.length} 个游戏` })
      } catch (error) {
        console.error('[fc-arcade] 删除游戏失败', error)
        toast({ variant: 'error', title: '删除失败', description: '部分数据可能没有清理干净。' })
      } finally {
        setBusy(false)
      }
    },
    [clearSelection, toast],
  )

  const exportSaves = useCallback(
    async (game: GameView) => {
      try {
        await downloadSaveStatesByGame(game.id, displayTitle(game))
        toast({ variant: 'success', title: `《${displayTitle(game)}》存档已导出` })
      } catch (error) {
        console.error('[fc-arcade] 导出游戏存档失败', error)
        toast({
          variant: 'error',
          title: '导出存档失败',
          description: error instanceof Error ? error.message : undefined,
        })
      }
    },
    [toast],
  )

  return { busy, play, toggleFavorite, favoriteMany, removeMany, exportSaves }
}

/** 删除确认里用到的提示文案 */
export function deleteConfirmText(games: GameView[]): { title: string; description: string } {
  if (games.length === 1) {
    return {
      title: `删除《${displayTitle(games[0])}》？`,
      description: '会同时删除这个游戏的 ROM、封面和全部存档，无法恢复。',
    }
  }
  return {
    title: `删除选中的 ${games.length} 个游戏？`,
    description: '会同时删除它们的 ROM、封面和全部存档，无法恢复。',
  }
}
