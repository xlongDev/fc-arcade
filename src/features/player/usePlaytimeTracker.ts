import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import { coverDao, gameDao, sessionDao } from '@/data'
import { notifyLibraryChanged, notifyStorageChanged } from '@/features/common/lib/storageEvents'
import { uid } from '@/lib/id'
import { useSettingsStore } from '@/store'
import type { EmulatorAdapter } from '@/types/emulator'
import { NES_VISIBLE_HEIGHT, NES_VISIBLE_WIDTH } from '@/types/emulator'
import type { GameView } from '@/types/game'

/** 少于这个时长不记一次游玩，避免误点进来就退出也算一局 */
const MIN_SESSION_MS = 5000
/** 自动截图的输出倍率 */
const COVER_SCALE = 2

interface Options {
  game: GameView | null
  adapterRef: RefObject<EmulatorAdapter | null>
}

/**
 * 消费模拟器的 playtime 事件：
 * 1. 累计真实运行时长，退出播放器时写 sessions 并更新游戏统计（暂停时长不计入）；
 * 2. 运行满设定秒数后自动截一张图当封面（仅当封面还是程序化生成的）。
 */
export function usePlaytimeTracker({ game, adapterRef }: Options): (seconds: number) => void {
  const autoScreenshotAfterSec = useSettingsStore((s) => s.settings.autoScreenshotAfterSec)

  const secondsRef = useRef(0)
  const capturedRef = useRef(false)
  const gameRef = useRef(game)
  gameRef.current = game

  const gameId = game?.id ?? null

  useEffect(() => {
    secondsRef.current = 0
    capturedRef.current = false
  }, [gameId])

  const captureCover = useCallback(async () => {
    const adapter = adapterRef.current
    const current = gameRef.current
    if (!adapter || !current) return
    try {
      const blob = await adapter.screenshot({ scale: COVER_SCALE, type: 'image/webp' })
      await coverDao.put({
        gameId: current.id,
        kind: 'screenshot',
        blob,
        width: NES_VISIBLE_WIDTH * COVER_SCALE,
        height: NES_VISIBLE_HEIGHT * COVER_SCALE,
        updatedAt: Date.now(),
      })
      await gameDao.update(current.id, { coverKind: 'screenshot' })
      notifyLibraryChanged()
      notifyStorageChanged()
    } catch (cause) {
      console.warn('[fc-arcade] 自动截图封面失败', cause)
    }
  }, [adapterRef])

  const onPlaytime = useCallback(
    (seconds: number) => {
      secondsRef.current = seconds
      const current = gameRef.current
      if (!current || capturedRef.current) return
      if (autoScreenshotAfterSec <= 0 || seconds < autoScreenshotAfterSec) return
      if (current.coverKind !== 'generated') return
      capturedRef.current = true
      void captureCover()
    },
    [autoScreenshotAfterSec, captureCover],
  )

  // 卸载时结算这一局。重新读一遍记录再累加，避免用页面上的旧计数覆盖别处的写入。
  useEffect(() => {
    if (gameId === null) return
    const startedAt = Date.now()
    return () => {
      const durationMs = Math.round(secondsRef.current * 1000)
      if (durationMs < MIN_SESSION_MS) return
      void (async () => {
        try {
          await sessionDao.add({ id: uid('ses'), gameId, startedAt, durationMs })
          const record = await gameDao.get(gameId)
          if (!record) return
          await gameDao.update(gameId, {
            playCount: record.playCount + 1,
            totalPlayMs: record.totalPlayMs + durationMs,
            lastPlayedAt: Date.now(),
          })
          notifyLibraryChanged()
        } catch (cause) {
          console.error('[fc-arcade] 写入游玩记录失败', cause)
        }
      })()
    }
  }, [gameId])

  return onPlaytime
}
