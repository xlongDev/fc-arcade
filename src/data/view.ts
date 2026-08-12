/**
 * GameRecord → GameView 的合并逻辑。
 * detected 是识别管线的产物（会被 reidentify 覆盖），overrides 是用户手改的（永不被覆盖）。
 */
import type { DetectedMeta, GameRecord, GameView, UserOverrides } from '@/types/game'

/** 允许用户覆盖的字段全集，顺序即 UI 上展示「已编辑」徽标的顺序 */
export const OVERRIDABLE_KEYS = [
  'title',
  'titleAlias',
  'year',
  'categories',
  'developer',
  'publisher',
  'players',
  'region',
  'description',
] as const satisfies ReadonlyArray<keyof UserOverrides>

/** 取出实际被用户改过的字段（值为 undefined 视为未改） */
export function getEditedFields(overrides: UserOverrides): Array<keyof UserOverrides> {
  return OVERRIDABLE_KEYS.filter((key) => overrides[key] !== undefined)
}

/** 合并 detected 与 overrides，得到实际生效的元数据 */
export function mergeMeta(detected: DetectedMeta, overrides: UserOverrides): DetectedMeta {
  const merged: DetectedMeta = { ...detected }
  for (const key of OVERRIDABLE_KEYS) {
    const value = overrides[key]
    if (value === undefined) continue
    // 逐字段赋值，避免 spread 把 undefined 也覆盖进去
    switch (key) {
      case 'title':
        merged.title = value as string
        break
      case 'titleAlias':
        merged.titleAlias = value as string | null
        break
      case 'year':
        merged.year = value as number | null
        break
      case 'categories':
        merged.categories = value as DetectedMeta['categories']
        break
      case 'developer':
        merged.developer = value as string | null
        break
      case 'publisher':
        merged.publisher = value as string | null
        break
      case 'players':
        merged.players = value as DetectedMeta['players']
        break
      case 'region':
        merged.region = value as DetectedMeta['region']
        break
      case 'description':
        merged.description = value as string | null
        break
    }
  }
  return merged
}

/** 落库记录 → 展示视图 */
export function toGameView(record: GameRecord): GameView {
  const meta = mergeMeta(record.detected, record.overrides)
  const editedFields = getEditedFields(record.overrides)
  return {
    ...meta,
    id: record.id,
    romId: record.romId,
    fileName: record.fileName,
    rom: record.rom,
    coverKind: record.coverKind,
    favorite: record.favorite,
    playCount: record.playCount,
    totalPlayMs: record.totalPlayMs,
    lastPlayedAt: record.lastPlayedAt,
    addedAt: record.addedAt,
    preferredCore: record.preferredCore,
    isEdited: editedFields.length > 0,
    editedFields,
  }
}
