import { Button, Checkbox, EmptyState } from '@/components/ui'
import { IconCartridge } from '@/components/icons'
import type { ImportCandidate, UserOverrides } from '@/types/game'

import { CandidateRow } from './CandidateRow'

interface Props {
  candidates: ImportCandidate[]
  selectedCount: number
  onToggle: (tempId: string) => void
  onToggleAll: (next: boolean) => void
  onPatch: (tempId: string, patch: UserOverrides) => void
  onPickMore: () => void
}

export function CandidateList({
  candidates,
  selectedCount,
  onToggle,
  onToggleAll,
  onPatch,
  onPickMore,
}: Props) {
  if (candidates.length === 0) {
    return (
      <EmptyState
        icon={<IconCartridge size={40} />}
        title="没有可导入的文件"
        description="选中的内容里没有 .nes / .fds / .unf / .unif / .zip 文件，换一批试试。"
        action={
          <Button variant="primary" onClick={onPickMore}>
            重新选择
          </Button>
        }
      />
    )
  }

  const importable = candidates.filter((item) => item.error === null).length
  const allSelected = importable > 0 && selectedCount === importable

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Checkbox checked={allSelected} onChange={() => onToggleAll(!allSelected)} />
          <span>全选可导入项</span>
        </label>
        <Button variant="ghost" size="sm" onClick={onPickMore}>
          再添加文件
        </Button>
      </div>

      <ul className="flex max-h-[46vh] min-h-0 flex-col gap-2 overflow-y-auto pr-1">
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.tempId}
            candidate={candidate}
            onToggle={onToggle}
            onPatch={onPatch}
          />
        ))}
      </ul>
    </div>
  )
}
