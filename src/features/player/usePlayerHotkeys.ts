import { useEffect, useMemo, useRef } from 'react'

import { useSettingsStore } from '@/store'
import type { KeyboardMap, PlayerIndex } from '@/types/input'
import type { SaveSlot } from '@/types/storage'

/** 数字键 → 槽位。Digit0 对应第 10 个槽位。 */
const DIGIT_SLOT: Readonly<Partial<Record<string, SaveSlot>>> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Digit6: 5,
  Digit7: 6,
  Digit8: 7,
  Digit9: 8,
  Digit0: 9,
}

export interface PlayerHotkeyHandlers {
  onTogglePause: () => void
  onReset: () => void
  onToggleFullscreen: () => void
  onToggleMute: () => void
  onExit: () => void
  onSaveSlot: (slot: SaveSlot) => void
  onLoadSlot: (slot: SaveSlot) => void
}

function collectBoundCodes(map: KeyboardMap): Set<string> {
  const codes = new Set<string>()
  for (const player of [0, 1] as PlayerIndex[]) {
    for (const list of Object.values(map[player])) {
      for (const code of list) codes.add(code)
    }
  }
  return codes
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * 播放器快捷键。
 *
 * 与游戏按键冲突时一律让位给游戏——玩家把 Space 绑成 A 键的话，
 * Space 就不该再暂停。Escape 例外，任何时候都要能退出去。
 */
export function usePlayerHotkeys(handlers: PlayerHotkeyHandlers, enabled: boolean): void {
  const keyboardMap = useSettingsStore((s) => s.settings.keyboardMap)
  const bound = useMemo(() => collectBoundCodes(keyboardMap), [keyboardMap])

  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const { code } = event

      if (code === 'Escape') {
        event.preventDefault()
        ref.current.onExit()
        return
      }

      const slot = DIGIT_SLOT[code]
      if (slot !== undefined && !bound.has(code) && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        if (event.shiftKey) ref.current.onSaveSlot(slot)
        else ref.current.onLoadSlot(slot)
        return
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (bound.has(code)) return

      switch (code) {
        case 'Space':
          event.preventDefault()
          ref.current.onTogglePause()
          break
        case 'KeyR':
          event.preventDefault()
          ref.current.onReset()
          break
        case 'KeyF':
          event.preventDefault()
          ref.current.onToggleFullscreen()
          break
        case 'KeyM':
          event.preventDefault()
          ref.current.onToggleMute()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bound, enabled])
}

export const HOTKEY_HINTS: ReadonlyArray<{ keys: string; label: string }> = [
  { keys: '空格', label: '暂停 / 继续' },
  { keys: 'R', label: '重置游戏' },
  { keys: 'F', label: '全屏' },
  { keys: 'M', label: '静音' },
  { keys: '1~0', label: '读取对应槽位' },
  { keys: 'Shift + 1~0', label: '保存到对应槽位' },
  { keys: 'Esc', label: '返回游戏库' },
]
