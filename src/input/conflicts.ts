/**
 * 改键辅助：冲突检测 + 不可变的映射表更新。
 * 供设置界面使用，纯函数，不依赖任何运行时状态。
 */
import type { KeyboardMap, KeyConflict, NesButton, PlayerIndex } from '@/types/input'
import { NES_BUTTONS } from '@/types/input'
import { PLAYERS } from './mask'

/**
 * 找出被重复绑定的物理键。
 * 同一个 code 绑在两个按键（或两个玩家）上时，按下会同时触发两者，通常是误操作。
 */
export function findKeyConflicts(map: KeyboardMap): KeyConflict[] {
  const owners = new Map<string, Array<{ player: PlayerIndex; button: NesButton }>>()

  for (const player of PLAYERS) {
    const playerMap = map[player]
    if (!playerMap) continue
    for (const button of NES_BUTTONS) {
      for (const code of playerMap[button] ?? []) {
        const list = owners.get(code)
        if (list) list.push({ player, button })
        else owners.set(code, [{ player, button }])
      }
    }
  }

  const conflicts: KeyConflict[] = []
  for (const [code, list] of owners) {
    if (list.length > 1) conflicts.push({ code, owners: list })
  }
  return conflicts
}

function cloneMap(map: KeyboardMap): KeyboardMap {
  return {
    0: { ...map[0] },
    1: { ...map[1] },
  }
}

/**
 * 给某个按键增加一个物理键。
 * 默认独占（先把这个 code 从其它所有绑定里摘掉），这也是改键界面的常规预期。
 */
export function assignKey(
  map: KeyboardMap,
  player: PlayerIndex,
  button: NesButton,
  code: string,
  options: { exclusive?: boolean; replace?: boolean } = {},
): KeyboardMap {
  const { exclusive = true, replace = false } = options
  const next = cloneMap(map)

  if (exclusive) {
    for (const other of PLAYERS) {
      for (const key of NES_BUTTONS) {
        const codes = next[other][key]
        if (codes.includes(code)) {
          next[other][key] = codes.filter((item) => item !== code)
        }
      }
    }
  }

  const current = replace ? [] : next[player][button]
  next[player][button] = current.includes(code) ? current : [...current, code]
  return next
}

/** 解绑某个物理键。映射表允许留空数组（该按键不可用），不做兜底填充。 */
export function unassignKey(
  map: KeyboardMap,
  player: PlayerIndex,
  button: NesButton,
  code: string,
): KeyboardMap {
  const next = cloneMap(map)
  next[player][button] = next[player][button].filter((item) => item !== code)
  return next
}
