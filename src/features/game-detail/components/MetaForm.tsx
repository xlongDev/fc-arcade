import type { ReactNode } from 'react'

import { Input, NumberInput, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { CATEGORY_LABEL, GAME_CATEGORIES, REGION_LABEL } from '@/types/game'
import type { DetectedMeta, GameCategory, Region } from '@/types/game'

import type { EditableMeta } from '../useGameEditor'

const REGIONS: readonly Region[] = ['JP', 'US', 'EU', 'CN', 'World', 'Unknown']

/** 人数下拉用字符串承载，'0' 表示未知 */
const PLAYER_OPTIONS = [
  { value: '0', label: '未知' },
  { value: '1', label: '单人' },
  { value: '2', label: '2 人' },
  { value: '3', label: '3 人' },
  { value: '4', label: '4 人' },
]

function toPlayers(raw: string): DetectedMeta['players'] {
  switch (raw) {
    case '1':
      return 1
    case '2':
      return 2
    case '3':
      return 3
    case '4':
      return 4
    default:
      return null
  }
}

interface FieldProps {
  label: string
  edited: boolean
  children: ReactNode
  className?: string
}

function Field({ label, edited, children, className }: FieldProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
        {label}
        {edited ? (
          <span className="size-1.5 rounded-full bg-[var(--color-accent)]" aria-label="已手动修改" />
        ) : null}
      </span>
      {children}
    </label>
  )
}

interface Props {
  draft: EditableMeta
  detected: DetectedMeta
  onPatch: (patch: Partial<EditableMeta>) => void
}

/** 元数据编辑表单。字段旁的小圆点表示该字段已偏离识别结果。 */
export function MetaForm({ draft, detected, onPatch }: Props) {
  const toggleCategory = (category: GameCategory) => {
    const next = draft.categories.includes(category)
      ? draft.categories.filter((c) => c !== category)
      : [...draft.categories, category]
    onPatch({ categories: next })
  }

  const categoriesEdited =
    draft.categories.length !== detected.categories.length ||
    draft.categories.some((c, i) => c !== detected.categories[i])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="标题（原名）" edited={draft.title !== detected.title}>
          <Input
            value={draft.title}
            onChange={(next: string) => onPatch({ title: next })}
            placeholder="例如 Contra"
          />
        </Field>

        <Field label="中文名 / 别名" edited={draft.titleAlias !== detected.titleAlias}>
          <Input
            value={draft.titleAlias ?? ''}
            onChange={(next: string) => onPatch({ titleAlias: next.length > 0 ? next : null })}
            placeholder="例如 魂斗罗"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="发行年份" edited={draft.year !== detected.year}>
          <NumberInput
            value={draft.year ?? 0}
            onChange={(next: number) => onPatch({ year: next > 0 ? next : null })}
            min={0}
            max={2100}
            step={1}
          />
        </Field>

        <Field label="地区版本" edited={draft.region !== detected.region}>
          <Select
            value={draft.region}
            onChange={(next: Region) => onPatch({ region: next })}
            options={REGIONS.map((region) => ({ value: region, label: REGION_LABEL[region] }))}
          />
        </Field>

        <Field label="游戏人数" edited={draft.players !== detected.players}>
          <Select
            value={String(draft.players ?? 0)}
            onChange={(next: string) => onPatch({ players: toPlayers(next) })}
            options={PLAYER_OPTIONS}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="开发商" edited={draft.developer !== detected.developer}>
          <Input
            value={draft.developer ?? ''}
            onChange={(next: string) => onPatch({ developer: next.length > 0 ? next : null })}
            placeholder="选填"
          />
        </Field>

        <Field label="发行商" edited={draft.publisher !== detected.publisher}>
          <Input
            value={draft.publisher ?? ''}
            onChange={(next: string) => onPatch({ publisher: next.length > 0 ? next : null })}
            placeholder="选填"
          />
        </Field>
      </div>

      <Field label="分类" edited={categoriesEdited}>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {GAME_CATEGORIES.map((category) => {
            const active = draft.categories.includes(category)
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
                onClick={() => toggleCategory(category)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  active
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]',
                )}
              >
                {CATEGORY_LABEL[category]}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="简介" edited={draft.description !== detected.description}>
        <textarea
          value={draft.description ?? ''}
          onChange={(event) => {
            const next = event.target.value
            onPatch({ description: next.length > 0 ? next : null })
          }}
          rows={4}
          placeholder="选填，写点通关心得或背景介绍"
          className="w-full resize-y rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/60 px-3 py-2.5 text-sm leading-relaxed text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)]"
        />
      </Field>
    </div>
  )
}
