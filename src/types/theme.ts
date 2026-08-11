/**
 * 主题契约。13 套主题 × 明暗两态。
 * 每套主题产出同一组 CSS 变量，挂在 <html data-theme data-mode> 上，
 * Tailwind v4 的 @theme 直接消费这些变量。
 */

export type ThemeId =
  | 'famicom'
  | 'nes-gray'
  | 'mario'
  | 'adventure-island'
  | 'contra'
  | 'megaman'
  | 'zelda'
  | 'metroid'
  | 'kirby'
  | 'tetris'
  | 'gameboy'
  | 'crt-amber'
  | 'neon-arcade'

export const THEME_IDS: readonly ThemeId[] = [
  'famicom',
  'nes-gray',
  'mario',
  'adventure-island',
  'contra',
  'megaman',
  'zelda',
  'metroid',
  'kirby',
  'tetris',
  'gameboy',
  'crt-amber',
  'neon-arcade',
] as const

export type ColorMode = 'light' | 'dark'
export type ColorModeSetting = ColorMode | 'system'

/**
 * 一套配色。所有值必须是合法 CSS 颜色。
 * 命名对应 CSS 变量 --color-<kebab-case>。
 */
export interface ThemePalette {
  /** 页面底色 */
  bg: string
  /** 大面积渐变的第二个色，用于背景光晕 */
  bgAlt: string
  /** 卡片/面板不透明底色 */
  surface: string
  surfaceAlt: string
  /** 玻璃层底色，必须带 alpha */
  glass: string
  /** 玻璃层描边，必须带 alpha */
  glassBorder: string
  /** 普通描边 */
  border: string
  text: string
  textMuted: string
  textFaint: string
  accent: string
  accentAlt: string
  /** accent 上的前景色，保证对比度 */
  onAccent: string
  success: string
  warning: string
  danger: string
  /** 阴影颜色，带 alpha */
  shadow: string
}

export interface ThemeEffects {
  /** CRT 扫描线不透明度 0~1，0 = 关闭 */
  scanline: number
  /** 玻璃模糊半径，px */
  glassBlur: number
  /** 噪点强度 0~1 */
  noise: number
  /** accent 发光强度 0~1 */
  glow: number
}

export interface ThemeRadius {
  sm: string
  md: string
  lg: string
  xl: string
  /** 超大圆角，用于主卡片 */
  huge: string
}

export interface ThemeDefinition {
  id: ThemeId
  name: string
  nameEn: string
  description: string
  /** 主题选择器上的三色预览条 */
  swatch: readonly [string, string, string]
  light: ThemePalette
  dark: ThemePalette
  radius: ThemeRadius
  effects: ThemeEffects
}

/** 生成的 CSS 变量键名，如 '--color-bg' */
export type ThemeCssVars = Record<string, string>

export interface ThemeContextValue {
  themeId: ThemeId
  mode: ColorMode
  modeSetting: ColorModeSetting
  theme: ThemeDefinition
  palette: ThemePalette
  setTheme: (id: ThemeId, origin?: { x: number; y: number }) => void
  setMode: (mode: ColorModeSetting, origin?: { x: number; y: number }) => void
  toggleMode: (origin?: { x: number; y: number }) => void
  /** 用户系统偏好 prefers-reduced-motion */
  reduceMotion: boolean
}
