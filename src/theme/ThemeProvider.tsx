import type { ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'

import { SETTINGS_STORAGE_KEY } from '@/config/defaults'
import type { ColorMode, ColorModeSetting, ThemeContextValue, ThemeId } from '@/types/theme'
import { THEME_IDS } from '@/types/theme'

import { ThemeContext } from './context'
import { ensureThemeStyles } from './cssVars'
import { THEMES } from './themes'
import type { TransitionOrigin } from './transition'
import { runThemeTransition } from './transition'

// 模块加载即注入主题变量表，早于 React 首帧，避免闪一下默认色
ensureThemeStyles()

const DEFAULT_THEME: ThemeId = 'famicom'
const DEFAULT_MODE: ColorModeSetting = 'system'

/** localStorage 里 zustand persist 的形状，只取我们关心的两个字段 */
interface PersistedBlob {
  state?: { settings?: Record<string, unknown> }
  [key: string]: unknown
}

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
}

function isModeSetting(value: unknown): value is ColorModeSetting {
  return value === 'light' || value === 'dark' || value === 'system'
}

function readStored(): { themeId: ThemeId; mode: ColorModeSetting } {
  if (typeof localStorage === 'undefined') return { themeId: DEFAULT_THEME, mode: DEFAULT_MODE }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return { themeId: DEFAULT_THEME, mode: DEFAULT_MODE }
    const settings = (JSON.parse(raw) as PersistedBlob).state?.settings
    return {
      themeId: isThemeId(settings?.themeId) ? settings.themeId : DEFAULT_THEME,
      mode: isModeSetting(settings?.mode) ? settings.mode : DEFAULT_MODE,
    }
  } catch {
    return { themeId: DEFAULT_THEME, mode: DEFAULT_MODE }
  }
}

/**
 * 写回 localStorage 时只合并这两个字段，不动 settings 里其它键，
 * 这样设置 store（另一条线）持久化的数据不会被覆盖。
 */
function persist(themeId: ThemeId, mode: ColorModeSetting): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    const blob: PersistedBlob = raw ? (JSON.parse(raw) as PersistedBlob) : {}
    const state = blob.state ?? {}
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...blob, state: { ...state, settings: { ...state.settings, themeId, mode } } }),
    )
  } catch {
    /* 隐私模式下 localStorage 会抛，忽略 */
  }
}

function matches(query: string): boolean {
  return typeof matchMedia === 'function' && matchMedia(query).matches
}

function resolveMode(setting: ColorModeSetting, systemDark: boolean): ColorMode {
  if (setting === 'system') return systemDark ? 'dark' : 'light'
  return setting
}

function applyToDom(themeId: ThemeId, mode: ColorMode): void {
  const root = document.documentElement
  root.dataset.theme = themeId
  root.dataset.mode = mode
}

/** 订阅一条 media query */
function useMediaQuery(query: string, initial: boolean): boolean {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mql = matchMedia(query)
    const onChange = (): void => {
      setValue(mql.matches)
    }
    onChange()
    mql.addEventListener('change', onChange)
    return () => {
      mql.removeEventListener('change', onChange)
    }
  }, [query])
  return value
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [stored] = useState(readStored)
  const [themeId, setThemeId] = useState<ThemeId>(stored.themeId)
  const [modeSetting, setModeSetting] = useState<ColorModeSetting>(stored.mode)

  const systemDark = useMediaQuery('(prefers-color-scheme: dark)', !matches('(prefers-color-scheme: light)'))
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)', matches('(prefers-reduced-motion: reduce)'))

  const mode = resolveMode(modeSetting, systemDark)

  // 状态 → DOM / localStorage
  useEffect(() => {
    applyToDom(themeId, mode)
    persist(themeId, modeSetting)
    // 让其它模块（设置 store、埋点）能感知主题变化
    window.dispatchEvent(new CustomEvent('fc-arcade:theme', { detail: { themeId, mode, modeSetting } }))
  }, [themeId, mode, modeSetting])

  // 其它标签页改了设置时跟随
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== SETTINGS_STORAGE_KEY) return
      const next = readStored()
      setThemeId(next.themeId)
      setModeSetting(next.mode)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setTheme = useCallback(
    (id: ThemeId, origin?: TransitionOrigin) => {
      if (id === themeId) return
      runThemeTransition(
        () => {
          applyToDom(id, mode)
          flushSync(() => {
            setThemeId(id)
          })
        },
        origin,
        reduceMotion,
      )
    },
    [themeId, mode, reduceMotion],
  )

  const setMode = useCallback(
    (next: ColorModeSetting, origin?: TransitionOrigin) => {
      if (next === modeSetting) return
      const nextMode = resolveMode(next, systemDark)
      runThemeTransition(
        () => {
          applyToDom(themeId, nextMode)
          flushSync(() => {
            setModeSetting(next)
          })
        },
        origin,
        reduceMotion,
      )
    },
    [modeSetting, systemDark, themeId, reduceMotion],
  )

  const toggleMode = useCallback(
    (origin?: TransitionOrigin) => {
      setMode(mode === 'dark' ? 'light' : 'dark', origin)
    },
    [mode, setMode],
  )

  const theme = THEMES[themeId]

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      mode,
      modeSetting,
      theme,
      palette: theme[mode],
      setTheme,
      setMode,
      toggleMode,
      reduceMotion,
    }),
    [themeId, mode, modeSetting, theme, setTheme, setMode, toggleMode, reduceMotion],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
