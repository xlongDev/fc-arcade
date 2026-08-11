import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import { createInputManager } from '@/input'
import { useSettingsStore } from '@/store'
import type { InputManager } from '@/types/input'

/**
 * 播放器页的输入管理器。
 *
 * 返回 ref 而不是值：rAF 循环每帧读 ref.current，避免管理器就绪时触发整页重渲染，
 * 也避免把它塞进 effect 依赖导致反复重建监听。
 */
export function usePlayerInput(enableTouch: boolean): RefObject<InputManager | null> {
  const managerRef = useRef<InputManager | null>(null)
  const keyboardMap = useSettingsStore((s) => s.settings.keyboardMap)
  const gamepadMap = useSettingsStore((s) => s.settings.gamepadMap)
  const turbo = useSettingsStore((s) => s.settings.turbo)

  // 只在挂载时建一次。构造即挂 window 监听，卸载必须 dispose。
  useEffect(() => {
    const manager = createInputManager()
    managerRef.current = manager
    return () => {
      manager.dispose()
      managerRef.current = null
    }
  }, [])

  useEffect(() => {
    managerRef.current?.setKeyboardMap(keyboardMap)
  }, [keyboardMap])

  useEffect(() => {
    managerRef.current?.setGamepadMap(gamepadMap)
  }, [gamepadMap])

  useEffect(() => {
    managerRef.current?.setTurbo(turbo)
  }, [turbo])

  // 虚拟手柄隐藏时清掉残留按下状态，否则切换布局会卡住一个方向键
  useEffect(() => {
    if (!enableTouch) managerRef.current?.clearTouch()
  }, [enableTouch])

  return managerRef
}
