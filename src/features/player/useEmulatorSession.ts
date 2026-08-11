import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import { romDao } from '@/data'
import { createEmulator } from '@/emulator'
import { useSettingsStore } from '@/store'
import type { Unsubscribe } from '@/types/common'
import type { EmulatorAdapter, EmulatorStats, EmulatorStatus } from '@/types/emulator'
import { EmulatorError } from '@/types/emulator'
import type { GameView } from '@/types/game'
import type { InputManager } from '@/types/input'

const EMPTY_STATS: EmulatorStats = { fps: 0, audioBuffered: 0, skippedFrames: 0, frameCostMs: 0 }

function toEmulatorError(cause: unknown): EmulatorError {
  if (cause instanceof EmulatorError) return cause
  const message = cause instanceof Error ? cause.message : '模拟器发生未知错误'
  return new EmulatorError('runtime', message, { cause })
}

export interface EmulatorSession {
  canvasRef: RefObject<HTMLCanvasElement | null>
  adapterRef: RefObject<EmulatorAdapter | null>
  status: EmulatorStatus
  error: EmulatorError | null
  stats: EmulatorStats
  /** 音频被浏览器策略拦下，需要一次用户手势 */
  audioBlocked: boolean
  running: boolean
  pause: () => void
  resume: () => void
  togglePause: () => void
  reset: () => void
  /** 出错后重建整个会话 */
  retry: () => void
  unlockAudio: () => Promise<void>
}

interface Options {
  game: GameView | null
  inputRef: RefObject<InputManager | null>
  /** 由页面持有，方便截图 / 存档等 hook 共用同一个适配器实例 */
  adapterRef: RefObject<EmulatorAdapter | null>
  /** 模拟器累计运行秒数回调，用于自动截图封面 */
  onPlaytime?: (seconds: number) => void
}

/**
 * 模拟器生命周期。
 *
 * 一个会话 = 一次 createEmulator + init + loadRom + start，随游戏 id 或重试次数重建。
 * 输入注入放在页面自己的 rAF 里：适配器只负责「拿到什么状态就跑什么帧」，
 * 输入采样的时机由页面掌握，暂停时可以直接停止注入。
 */
export function useEmulatorSession({
  game,
  inputRef,
  adapterRef,
  onPlaytime,
}: Options): EmulatorSession {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const defaultCore = useSettingsStore((s) => s.settings.defaultCore)
  const volume = useSettingsStore((s) => s.settings.volume)
  const muted = useSettingsStore((s) => s.settings.muted)
  const integerScale = useSettingsStore((s) => s.settings.integerScale)

  const [status, setStatus] = useState<EmulatorStatus>('idle')
  const [error, setError] = useState<EmulatorError | null>(null)
  const [stats, setStats] = useState<EmulatorStats>(EMPTY_STATS)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const playtimeRef = useRef(onPlaytime)
  playtimeRef.current = onPlaytime

  // 音量在会话运行期间可以热改，不该进 effect 依赖，否则拖一下音量条就重载 ROM
  const volumeRef = useRef({ volume, muted })
  volumeRef.current = { volume, muted }

  const gameId = game?.id ?? null
  const romId = game?.romId ?? null
  const core = game?.preferredCore ?? defaultCore

  useEffect(() => {
    if (gameId === null || romId === null) return
    const canvas = canvasRef.current
    if (!canvas) return

    let alive = true
    let created: EmulatorAdapter | null = null
    const unsubs: Unsubscribe[] = []

    setStatus('loading')
    setError(null)
    setAudioBlocked(false)

    const boot = async () => {
      const adapter = await createEmulator(core)
      if (!alive) {
        adapter.dispose()
        return
      }
      created = adapter

      unsubs.push(
        adapter.on('status', (next) => {
          if (alive) setStatus(next)
        }),
        adapter.on('stats', (next) => {
          if (alive) setStats(next)
        }),
        adapter.on('error', (next) => {
          if (!alive) return
          if (next.code === 'audio-blocked') {
            setAudioBlocked(true)
            return
          }
          setError(next)
        }),
        adapter.on('playtime', (seconds) => {
          playtimeRef.current?.(seconds)
        }),
      )

      await adapter.init(canvas, {
        volume: volumeRef.current.muted ? 0 : volumeRef.current.volume,
        audio: true,
        integerScale,
      })
      if (!alive) return

      const buffer = await romDao.getBuffer(romId)
      if (!buffer) {
        throw new EmulatorError('invalid-rom', 'ROM 数据已丢失，请重新导入这个游戏')
      }
      if (!alive) return

      await adapter.loadRom(buffer)
      if (!alive) return

      adapterRef.current = adapter
      adapter.start()
    }

    void boot().catch((cause: unknown) => {
      if (!alive) return
      console.error('[fc-arcade] 模拟器启动失败', cause)
      setError(toEmulatorError(cause))
      setStatus('error')
    })

    return () => {
      alive = false
      for (const unsub of unsubs) unsub()
      adapterRef.current = null
      created?.dispose()
    }
    // 依赖只列会话级参数。integerScale 是 init 时的选项，改了必须重建；
    // 音量走 volumeRef，改音量不重载 ROM。
  }, [gameId, romId, core, attempt, integerScale, adapterRef])

  // 音量热更新，不重建会话
  useEffect(() => {
    adapterRef.current?.setVolume(muted ? 0 : volume)
  }, [volume, muted, adapterRef])

  // 每帧注入输入。暂停时不注入，避免松手前的按键被一直保持。
  useEffect(() => {
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const adapter = adapterRef.current
      const input = inputRef.current
      if (!adapter || !input) return
      if (adapter.status !== 'running') {
        input.clearAll()
        return
      }
      adapter.setInput(input.update(now))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inputRef, adapterRef])

  // 切到后台自动暂停：手机上锁屏还在跑帧既费电又会把音频缓冲搞乱
  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) {
        adapterRef.current?.pause()
        inputRef.current?.clearAll()
      }
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [inputRef, adapterRef])

  const pause = useCallback(() => adapterRef.current?.pause(), [adapterRef])
  const resume = useCallback(() => adapterRef.current?.resume(), [adapterRef])
  const reset = useCallback(() => adapterRef.current?.reset(), [adapterRef])

  const togglePause = useCallback(() => {
    const adapter = adapterRef.current
    if (!adapter) return
    if (adapter.status === 'running') adapter.pause()
    else adapter.resume()
  }, [adapterRef])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const unlockAudio = useCallback(async () => {
    const adapter = adapterRef.current
    if (!adapter) return
    try {
      await adapter.unlockAudio()
      setAudioBlocked(false)
    } catch (cause) {
      console.warn('[fc-arcade] 解锁音频失败', cause)
    }
  }, [adapterRef])

  return {
    canvasRef,
    adapterRef,
    status,
    error,
    stats,
    audioBlocked,
    running: status === 'running',
    pause,
    resume,
    togglePause,
    reset,
    retry,
    unlockAudio,
  }
}
