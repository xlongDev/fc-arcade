import { useCallback, useEffect, useRef, useState } from 'react'

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

  const loadedGameIdRef = useRef<string | null>(null)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (gameId === null) {
      setGame(null)
      setLoading(false)
      setMissing(true)
      loadedGameIdRef.current = null
      return
    }
    let alive = true
    // 仅首次加载 / 切换游戏时显示加载态。刷新（version 变化，例如 notifyLibraryChanged
    // 触发的重新拉取）时保持当前画面——否则 loading 闪烁会把整个播放器卸载成 Spinner
    // 再重挂，导致 canvas 节点被替换、模拟器误重启（见 useEmulatorSession 的 setCanvasRef）。
    const firstLoad = loadedGameIdRef.current !== gameId
    if (firstLoad) setLoading(true)
    loadedGameIdRef.current = gameId
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
        if (alive && firstLoad) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [gameId, version])

  useEffect(() => onLibraryChanged(refresh), [refresh])

  return { game, loading, missing, refresh }
}
