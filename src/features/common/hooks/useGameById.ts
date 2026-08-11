import { useCallback, useEffect, useState } from 'react'

import { gameDao, toGameView } from '@/data'
import type { GameView } from '@/types/game'

import { onLibraryChanged } from '../lib/storageEvents'

/**
 * 按 id 取单个游戏视图。
 * 播放器直接进 URL 时库列表可能还没加载，所以走 DAO 单查而不是从列表里 find。
 */
export function useGameById(gameId: string | null): {
  game: GameView | null
  loading: boolean
  /** 记录确实不存在（区别于「还在加载」） */
  missing: boolean
  refresh: () => void
} {
  const [game, setGame] = useState<GameView | null>(null)
  const [loading, setLoading] = useState(gameId !== null)
  const [missing, setMissing] = useState(false)
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (gameId === null) {
      setGame(null)
      setLoading(false)
      setMissing(true)
      return
    }
    let alive = true
    setLoading(true)
    void gameDao
      .get(gameId)
      .then((record) => {
        if (!alive) return
        setGame(record ? toGameView(record) : null)
        setMissing(!record)
      })
      .catch((cause: unknown) => {
        console.error('[fc-arcade] 读取游戏失败', cause)
        if (alive) setMissing(true)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [gameId, version])

  useEffect(() => onLibraryChanged(refresh), [refresh])

  return { game, loading, missing, refresh }
}
