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
}

function hsl(hue: number, sat: number, light: number): string {
  return `hsl(${hue} ${sat}% ${light}%)`
}

/** 与主题强调色混合。mix 越大越贴近主题色。 */
function blend(color: string, mix: number): string {
  return `color-mix(in oklab, ${color} ${100 - mix}%, var(--color-accent) ${mix}%)`
}

export function coverVars(seed: CoverSeed): CoverVars {
  const { hue, hueAlt, sat, light, accentMix } = seed
  return {
    '--fcov-bg-a': blend(hsl(hue, sat, light), accentMix),
    '--fcov-bg-b': blend(hsl(hueAlt, sat - 8, Math.max(8, light - 8)), Math.round(accentMix / 2)),
    '--fcov-ink': blend(hsl(hueAlt, sat + 14, light + 34), accentMix + 14),
    '--fcov-plate': blend(hsl(hue, sat - 18, light + 10), accentMix),
    '--fcov-plate-edge': blend(hsl(hue, sat, light + 46), accentMix + 20),
    '--fcov-text': `color-mix(in oklab, ${hsl(hue, 24, 96)} 82%, var(--color-accent) 18%)`,
    '--fcov-glow': blend(hsl(hueAlt, sat + 20, light + 40), accentMix + 26),
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
