/**
 * 播放器页接入输入系统的 hook。
 *
 * 用法（播放器页的 rAF 循环里）：
 *   const { manager } = useInput({ keyboardMap, gamepadMap, turbo, vibration })
 *   // 每帧：
 *   adapter.setInput(manager.update(performance.now()))
 *
 * 配置一律从参数进来（调用方自己从 settings store 取），这一层不 import 任何 store，
 * 保持可测试、可复用。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GamepadInfo,
  GamepadMap,
  KeyboardMap,
  NesButton,
  PlayerIndex,
  TurboConfig,
} from '@/types/input'
import { DEFAULT_GAMEPAD_MAP, DEFAULT_KEYBOARD_MAP, DEFAULT_TURBO } from '@/config/defaults'
import type { ManagedInputManager } from './InputManager'
import { createInputManager } from './InputManager'
import type { RumbleOptions } from './GamepadSource'
import { GamepadSource } from './GamepadSource'

export interface UseInputOptions {
  keyboardMap?: KeyboardMap
  gamepadMap?: GamepadMap
  turbo?: TurboConfig
  vibration?: boolean
  /** 关闭时摘掉所有监听器（比如弹出设置对话框时不希望按键穿透到游戏） */
  enabled?: boolean
}

export interface UseInputResult {
  manager: ManagedInputManager
  /** 当前在位的手柄，随插拔更新 */
  gamepads: GamepadInfo[]
  setTouchButton: (player: PlayerIndex, button: NesButton, pressed: boolean) => void
  clearTouch: () => void
  clearAll: () => void
  rumble: (player: PlayerIndex, options?: RumbleOptions) => void
}

export function useInput(options: UseInputOptions = {}): UseInputResult {
  const {
    keyboardMap = DEFAULT_KEYBOARD_MAP,
    gamepadMap = DEFAULT_GAMEPAD_MAP,
    turbo = DEFAULT_TURBO,
    vibration = false,
    enabled = true,
  } = options

  const managerRef = useRef<ManagedInputManager | null>(null)
  // StrictMode 下 effect 会挂载两次，第一次 cleanup 可能已经 dispose；
  // 这里按需重建，保证拿到的永远是可用实例。
  if (managerRef.current === null || managerRef.current.disposed) {
    managerRef.current = createInputManager({
      keyboardMap,
      gamepadMap,
      turbo,
      vibration,
      autoAttach: false,
    })
  }
  const manager = managerRef.current

  const [gamepads, setGamepads] = useState<GamepadInfo[]>([])

  useEffect(() => {
    if (!enabled) {
      manager.detach()
      return
    }
    manager.attach()
    return () => {
      manager.detach()
    }
  }, [manager, enabled])

  useEffect(() => {
    setGamepads(manager.getGamepads())
    return manager.onGamepadChange(setGamepads)
  }, [manager])

  useEffect(() => {
    manager.setKeyboardMap(keyboardMap)
  }, [manager, keyboardMap])

  useEffect(() => {
    manager.setGamepadMap(gamepadMap)
  }, [manager, gamepadMap])

  useEffect(() => {
    manager.setTurbo(turbo)
  }, [manager, turbo])

  useEffect(() => {
    manager.setVibration(vibration)
  }, [manager, vibration])

  const setTouchButton = useCallback(
    (player: PlayerIndex, button: NesButton, pressed: boolean) => {
      manager.setTouchButton(player, button, pressed)
    },
    [manager],
  )

  const clearTouch = useCallback(() => {
    manager.clearTouch()
  }, [manager])

  const clearAll = useCallback(() => {
    manager.clearAll()
  }, [manager])

  const rumble = useCallback(
    (player: PlayerIndex, rumbleOptions?: RumbleOptions) => {
      manager.rumble(player, rumbleOptions)
    },
    [manager],
  )

  return { manager, gamepads, setTouchButton, clearTouch, clearAll, rumble }
}

/** 设备列表刷新间隔。只是为了兜住不派发 connected 事件的浏览器，不需要每帧。 */
const GAMEPAD_SCAN_INTERVAL_MS = 500

/**
 * 只关心手柄在位情况的场景（设置页的「已连接手柄」列表）。
 * 直接用 GamepadSource，不经过 InputManager —— 否则会连带挂上键盘监听，
 * 设置页里按方向键就会被 preventDefault 掉。
 */
export function useGamepads(): GamepadInfo[] {
  const [gamepads, setGamepads] = useState<GamepadInfo[]>([])

  useEffect(() => {
    const source = new GamepadSource({ map: DEFAULT_GAMEPAD_MAP, onChange: setGamepads })
    source.attach()
    const timer = window.setInterval(() => {
      source.poll()
    }, GAMEPAD_SCAN_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
      source.setOnChange(undefined)
      source.detach()
    }
  }, [])

  return gamepads
}
