/**
 * 封面配色。
 *
 * 每个色都是「种子色相 + 当前主题强调色」的 color-mix：
 * 既保证同一游戏永远同一张封面，又能在切主题时整墙封面一起变调，
 * 不会出现封面墙和界面配色打架。
 *
 * 输出的是 CSS 变量值，挂在 <svg style> 上，由注入的样式表消费。
 */
import type { CoverSeed } from './hash'

/** 注入到 <head> 的类名前缀，全局唯一 */
export const COVER_CLASS = 'fcov'

export interface CoverVars {
  '--fcov-bg-a': string
  '--fcov-bg-b': string
  '--fcov-ink': string
  '--fcov-plate': string
  '--fcov-plate-edge': string
  '--fcov-text': string
  '--fcov-glow': string
  '--fcov-scan': string
  '--fcov-vignette': string
  '--fcov-plate-shine': string
  '--fcov-plate-shadow': string
}

function hsl(hue: number, sat: number, light: number): string {
  return `hsl(${hue} ${sat}% ${light}%)`
}

/** 与主题强调色混合。mix 越大越贴近主题色。 */
function blend(color: string, mix: number): string {
  return `color-mix(in oklab, ${color} ${100 - mix}%, var(--color-accent) ${mix}%)`
}

/** 同一个颜色在 light / dark 模式下分别取什么值，交给 CSS light-dark() 处理。 */
function lightAware(lightValue: string, darkValue: string): string {
  return `light-dark(${lightValue}, ${darkValue})`
}

export function coverVars(seed: CoverSeed): CoverVars {
  const { hue, hueAlt, sat, light, accentMix } = seed

  // 暗色模式：保持原有低明度卡带质感
  const darkBgA = blend(hsl(hue, sat, light), accentMix)
  const darkBgB = blend(hsl(hueAlt, sat - 8, Math.max(8, light - 8)), Math.round(accentMix / 2))
  const darkInk = blend(hsl(hueAlt, sat + 14, light + 34), accentMix + 14)
  const darkPlate = blend(hsl(hue, sat - 18, light + 10), accentMix)
  const darkPlateEdge = blend(hsl(hue, sat, light + 46), accentMix + 20)
  const darkText = `color-mix(in oklab, ${hsl(hue, 24, 96)} 82%, var(--color-accent) 18%)`
  const darkGlow = blend(hsl(hueAlt, sat + 20, light + 40), accentMix + 26)

  // 浅色模式：提高明度，降低与强调色的混合比例，避免在米白页面上显得脏
  const lightMix = Math.max(4, Math.round(accentMix / 2))
  const lightBgA = blend(hsl(hue, sat, 88), lightMix)
  const lightBgB = blend(hsl(hueAlt, sat - 8, 82), Math.round(lightMix / 2))
  const lightInk = blend(hsl(hueAlt, sat + 6, 38), lightMix + 8)
  const lightPlate = blend(hsl(hue, sat - 18, 95), lightMix)
  const lightPlateEdge = blend(hsl(hue, sat, 52), lightMix + 10)
  const lightText = `color-mix(in oklab, ${hsl(hue, 32, 18)} 72%, var(--color-accent) 28%)`
  const lightGlow = blend(hsl(hueAlt, sat + 10, 80), lightMix + 8)

  return {
    '--fcov-bg-a': lightAware(lightBgA, darkBgA),
    '--fcov-bg-b': lightAware(lightBgB, darkBgB),
    '--fcov-ink': lightAware(lightInk, darkInk),
    '--fcov-plate': lightAware(lightPlate, darkPlate),
    '--fcov-plate-edge': lightAware(lightPlateEdge, darkPlateEdge),
    '--fcov-text': lightAware(lightText, darkText),
    '--fcov-glow': lightAware(lightGlow, darkGlow),
    '--fcov-scan': lightAware('rgba(0, 0, 0, 0.14)', 'rgba(0, 0, 0, 0.5)'),
    '--fcov-vignette': lightAware('rgba(255, 255, 255, 0.24)', 'rgba(0, 0, 0, 0.42)'),
    '--fcov-plate-shine': lightAware('rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.2)'),
    '--fcov-plate-shadow': lightAware('rgba(0, 0, 0, 0.08)', 'rgba(0, 0, 0, 0.24)'),
  }
}

/**
 * 封面用到的 fill/stroke 规则只注入一次。
 * SVG 内联 <style> 是全局作用域，每张封面各带一份等于往文档里塞几百个重复样式表；
 * 这里改成 head 里一份类名规则 + 每个实例自己的 CSS 变量。
 */
const STYLE_ID = 'fc-arcade-cover-styles'

const CSS = `
.${COVER_CLASS}{display:block;overflow:hidden}
.${COVER_CLASS} .${COVER_CLASS}-ink{fill:var(--fcov-ink)}
.${COVER_CLASS} .${COVER_CLASS}-ink-s{fill:none;stroke:var(--fcov-ink);stroke-linecap:square}
.${COVER_CLASS} .${COVER_CLASS}-plate{fill:var(--fcov-plate)}
.${COVER_CLASS} .${COVER_CLASS}-edge{fill:none;stroke:var(--fcov-plate-edge)}
.${COVER_CLASS} .${COVER_CLASS}-text{fill:var(--fcov-text);dominant-baseline:central;text-anchor:middle}
.${COVER_CLASS} .${COVER_CLASS}-glow{fill:var(--fcov-glow)}
`

export function ensureCoverStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.append(style)
}
