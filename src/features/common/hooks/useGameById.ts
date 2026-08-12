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
  // 已成功加载过的 gameId，用于区分「首屏 / 切换游戏」与「刷新」：
  // - 首屏 / 切游戏 → 需要 Spinner 覆盖（isFirstLoad = true）
  // - 刷新（notifyLibraryChanged 触发的重新拉取）→ 保持当前画面，避免 Spinner 把播放器
  //   卸载成 Spinner 再重挂，导致 canvas 节点被替换、模拟器误重启（见 useEmulatorSession 的
  //   setCanvasRef）。此时 isFirstLoad = false，不触发 loading。
  // 注意：这里必须用 state 而非 ref。React StrictMode 下 effect 会双调用，若用 ref 在 effect
  // 开头就改写它，第二次运行会误判为「已加载」从而跳过 loading 收尾，导致 loading 永久为 true
  // （表现为一直转圈）。state 在重跑 effect 时走的是同一 render 闭包，不会被提前改写。
  const [loadedGameId, setLoadedGameId] = useState<string | null>(null)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (gameId === null) {
      setGame(null)
      setLoading(false)
      setMissing(true)
      setLoadedGameId(null)
      return
    }
    let alive = true
    const isFirstLoad = loadedGameId !== gameId
    if (isFirstLoad) setLoading(true)
    void gameDao
      .get(gameId)
      .then((record) => {
        if (!alive) return
        setGame(record ? toGameView(record) : null)
        setMissing(!record)
        setLoadedGameId(gameId)
      })
      .catch((cause: unknown) => {
        console.error('[fc-arcade] 读取游戏失败', cause)
        if (alive) {
          setMissing(true)
          setLoadedGameId(gameId)
        }
      })
      .finally(() => {
        if (alive && isFirstLoad) setLoading(false)
      })
    return () => {
      alive = false
    }
    // loadedGameId 故意不进依赖：仅在 gameId / version 变化时重新拉取，避免 setLoadedGameId
    // 触发额外的 effect 重跑与重复请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, version])

  useEffect(() => onLibraryChanged(refresh), [refresh])

  return { game, loading, missing, refresh }
}
