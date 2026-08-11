import { createContext, use } from 'react'

import type { ThemeContextValue } from '@/types/theme'

export const ThemeContext = createContext<ThemeContextValue | null>(null)

/** 读取当前主题。必须在 <ThemeProvider> 内部调用。 */
export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext)
  if (!value) throw new Error('useTheme 必须在 <ThemeProvider> 内部使用')
  return value
}
