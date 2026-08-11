/**
 * 主题 → CSS 变量。
 *
 * 变量并不是逐次用 inline style 打到 :root 上的，而是在模块加载时一次性生成
 * 全部 13×2 组规则注入 <style>，靠 <html data-theme data-mode> 选中。
 * 这样 index.html 里的防闪白脚本一写上 data-* 属性就能立刻拿到正确配色，
 * 切换主题时也只是换一个属性，不会触发 26 次样式重算。
 */
import type { ColorMode, ThemeDefinition, ThemePalette } from '@/types/theme'
import { THEME_IDS } from '@/types/theme'
import { THEMES } from './themes'

/** ThemePalette 字段 → CSS 变量名 */
const PALETTE_VAR: Readonly<Record<keyof ThemePalette, string>> = {
  bg: '--color-bg',
  bgAlt: '--color-bg-alt',
  surface: '--color-surface',
  surfaceAlt: '--color-surface-alt',
  glass: '--color-glass',
  glassBorder: '--color-glass-border',
  border: '--color-border',
  text: '--color-text',
  textMuted: '--color-text-muted',
  textFaint: '--color-text-faint',
  accent: '--color-accent',
  accentAlt: '--color-accent-alt',
  onAccent: '--color-on-accent',
  success: '--color-success',
  warning: '--color-warning',
  danger: '--color-danger',
  shadow: '--color-shadow',
}

const PALETTE_KEYS = Object.keys(PALETTE_VAR) as (keyof ThemePalette)[]

/** 生成一套主题在指定明暗下的全部 CSS 变量 */
export function themeVars(theme: ThemeDefinition, mode: ColorMode): Record<string, string> {
  const palette = theme[mode]
  const vars: Record<string, string> = {}

  for (const key of PALETTE_KEYS) vars[PALETTE_VAR[key]] = palette[key]

  vars['--radius-sm'] = theme.radius.sm
  vars['--radius-md'] = theme.radius.md
  vars['--radius-lg'] = theme.radius.lg
  vars['--radius-xl'] = theme.radius.xl
  vars['--radius-huge'] = theme.radius.huge

  vars['--glass-blur'] = `${theme.effects.glassBlur}px`
  vars['--scanline-opacity'] = String(theme.effects.scanline)
  vars['--noise-opacity'] = String(theme.effects.noise)
  vars['--glow'] = String(theme.effects.glow)

  // 浏览器原生控件（滚动条、表单）跟随明暗
  vars['color-scheme'] = mode

  return vars
}

function declarations(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}

/** 把 13 套主题 × 明暗两态编译成一整张样式表 */
export function buildThemeStylesheet(): string {
  const chunks: string[] = []

  // 兜底：属性缺失时按默认主题的暗色渲染
  chunks.push(`:root{${declarations(themeVars(THEMES.famicom, 'dark'))}}`)

  for (const id of THEME_IDS) {
    const theme = THEMES[id]
    for (const mode of ['dark', 'light'] as const) {
      chunks.push(
        `:root[data-theme="${id}"][data-mode="${mode}"]{${declarations(themeVars(theme, mode))}}`,
      )
    }
    // 只写了 data-theme 没写 data-mode 时，按暗色兜底
    chunks.push(`:root[data-theme="${id}"]:not([data-mode]){${declarations(themeVars(theme, 'dark'))}}`)
  }

  return chunks.join('\n')
}

const STYLE_ID = 'fc-theme-vars'

/** 幂等地把主题样式表塞进 <head>。模块加载期同步执行，早于首帧绘制。 */
export function ensureThemeStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = buildThemeStylesheet()
  document.head.append(style)
}
