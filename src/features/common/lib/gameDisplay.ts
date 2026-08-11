import { CATEGORY_LABEL } from '@/types/game'
import type { DetectedMeta, GameCategory, GameView, MatchConfidence } from '@/types/game'

/**
 * 展示用主标题：中文别名优先。
 * 库里大量条目是英文原名，中文玩家按「魂斗罗」找而不是「Contra」。
 */
export function displayTitle(game: Pick<DetectedMeta, 'title' | 'titleAlias'>): string {
  const alias = game.titleAlias?.trim()
  return alias && alias.length > 0 ? alias : game.title
}

/** 副标题：主标题用了别名时才显示英文原名，避免重复 */
export function displaySubtitle(game: Pick<DetectedMeta, 'title' | 'titleAlias'>): string | null {
  const alias = game.titleAlias?.trim()
  if (!alias || alias.length === 0) return null
  if (alias === game.title) return null
  return game.title
}

export function categoryLabels(categories: readonly GameCategory[]): string[] {
  return categories.map((c) => CATEGORY_LABEL[c])
}

/** 置信度 → Badge 配色。集中在这里，配色规则变更只改一处。 */
export const CONFIDENCE_BADGE: Readonly<Record<MatchConfidence, string>> = {
  exact: 'success',
  high: 'accent',
  medium: 'info',
  low: 'warning',
  none: 'default',
}

export function playersLabel(players: DetectedMeta['players']): string {
  if (!players) return '人数未知'
  return players === 1 ? '单人' : `${players} 人`
}

/** 卡片右下角那行摘要 */
export function gameMetaLine(game: GameView): string {
  const parts: string[] = []
  if (game.year) parts.push(`${game.year}`)
  if (game.categories.length > 0) parts.push(CATEGORY_LABEL[game.categories[0]])
  if (game.publisher) parts.push(game.publisher)
  return parts.join(' · ')
}
