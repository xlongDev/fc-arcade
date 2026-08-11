import { useSettingsStore } from '@/store'

import { usePrefersReducedMotion } from './useMediaQuery'

/**
 * 是否应当削减动效。
 * 用户显式开关优先，系统 prefers-reduced-motion 兜底——两者任一为真就削减。
 */
export function useReduceMotion(): boolean {
  const systemPref = usePrefersReducedMotion()
  const settingPref = useSettingsStore((s) => s.settings.reduceMotion)
  return systemPref || settingPref
}
