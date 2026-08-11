import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { Badge, Checkbox, IconButton, Input, NumberInput } from '@/components/ui'
import { IconAlert, IconEdit } from '@/components/icons'
import { CONFIDENCE_BADGE } from '@/features/common/lib/gameDisplay'
import { SPRING_SOFT } from '@/features/common/motion'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import { CATEGORY_LABEL, CONFIDENCE_LABEL } from '@/types/game'
import type { ImportCandidate, UserOverrides } from '@/types/game'

interface Props {
  candidate: ImportCandidate
  onToggle: (tempId: string) => void
  onPatch: (tempId: string, patch: UserOverrides) => void
}

export function CandidateRow({ candidate, onToggle, onPatch }: Props) {
  const [editing, setEditing] = useState(false)

  const detected = candidate.detected
  const title = candidate.overrides.title ?? detected?.title ?? candidate.fileName
  const alias = candidate.overrides.titleAlias ?? detected?.titleAlias ?? null
  const year = candidate.overrides.year ?? detected?.year ?? null
  const confidence = detected?.confidence ?? 'none'
  const failed = candidate.error !== null
  const duplicated = candidate.duplicateOf !== null

  return (
    <li
      className={cn(
        'rounded-2xl border px-3 py-3 transition-colors sm:px-4',
        failed
          ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5'
          : candidate.selected
            ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5'
            : 'border-[var(--color-border)] bg-[var(--color-surface-alt)]/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('pt-1', failed && 'pointer-events-none opacity-40')}>
          <Checkbox checked={candidate.selected} onChange={() => onToggle(candidate.tempId)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-[var(--color-text)]">
              {alias ?? title}
            </span>
            {alias && alias !== title ? (
              <span className="truncate text-xs text-[var(--color-text-faint)]">{title}</span>
            ) : null}
            {year ? (
              <span className="font-pixel text-[10px] text-[var(--color-text-muted)]">{year}</span>
            ) : null}
          </div>

          <p className="mt-0.5 truncate text-xs text-[var(--color-text-faint)]">
            {candidate.fileName}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={CONFIDENCE_BADGE[confidence]} size="sm">
              {CONFIDENCE_LABEL[confidence]}
            </Badge>
            {detected?.categories.slice(0, 2).map((category) => (
              <Badge key={category} variant="default" size="sm">
                {CATEGORY_LABEL[category]}
              </Badge>
            ))}
            {candidate.rom ? (
              <span className="font-pixel text-[10px] text-[var(--color-text-faint)]">
                Mapper {candidate.rom.mapper}
              </span>
            ) : null}
            <span className="text-[10px] text-[var(--color-text-faint)]">
              {formatBytes(candidate.fileSize)}
            </span>
            {duplicated ? (
              <Badge variant="warning" size="sm">
                已存在
              </Badge>
            ) : null}
          </div>

          {failed ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-danger)]">
              <IconAlert size={13} />
              {candidate.error}
            </p>
          ) : null}
        </div>

        {failed ? null : (
          <IconButton
            label={editing ? '收起编辑' : '编辑标题与年份'}
            size="sm"
            variant="ghost"
            active={editing}
            onClick={() => setEditing((v) => !v)}
          >
            <IconEdit size={15} />
          </IconButton>
        )}
      </div>

      <AnimatePresence initial={false}>
        {editing ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING_SOFT}
            className="overflow-hidden"
          >
            <div className="mt-3 grid gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-[2fr_1fr_1fr]">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--color-text-muted)]">标题</span>
                <Input
                  value={title}
                  onChange={(next: string) => onPatch(candidate.tempId, { title: next })}
                  placeholder="英文原名"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--color-text-muted)]">中文名</span>
                <Input
                  value={alias ?? ''}
                  onChange={(next: string) =>
                    onPatch(candidate.tempId, { titleAlias: next.length > 0 ? next : null })
                  }
                  placeholder="选填"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--color-text-muted)]">年份</span>
                <NumberInput
                  value={year ?? 0}
                  onChange={(next: number) =>
                    onPatch(candidate.tempId, { year: next > 0 ? next : null })
                  }
                  min={0}
                  max={2100}
                />
              </label>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  )
}
