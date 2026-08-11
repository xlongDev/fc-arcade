import { Button, Spinner } from '@/components/ui'
import { IconTrash } from '@/components/icons'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { SAVE_SLOTS } from '@/types/storage'
import type { SaveSlot, SaveStateRow } from '@/types/storage'

import { slotLabel } from '../useSaveSlots'
import { SlotThumb } from './SlotThumb'

interface SlotCardProps {
  slot: SaveSlot
  row: SaveStateRow | undefined
  busy: boolean
  onSave: () => void
  onLoad: () => void
  onRemove: () => void
}

function SlotCard({ slot, row, busy, onSave, onLoad, onRemove }: SlotCardProps) {
  const filled = row !== undefined

  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 rounded-2xl border p-2 transition-colors',
        filled
          ? 'border-[var(--color-accent)]/45 bg-[var(--color-surface-alt)]/60'
          : 'border-dashed border-[var(--color-border)] bg-transparent',
      )}
    >
      <SlotThumb blob={row?.thumb ?? null} />

      <div className="flex items-baseline justify-between gap-1">
        <span className="font-pixel text-[10px] text-[var(--color-text)]">{slotLabel(slot)}</span>
        {filled ? (
          <span className="truncate text-[10px] text-[var(--color-text-faint)]">
            {formatRelativeTime(row.createdAt)}
          </span>
        ) : (
          <span className="text-[10px] text-[var(--color-text-faint)]">空</span>
        )}
      </div>

      <div className="flex gap-1">
        <Button variant="secondary" size="sm" fullWidth disabled={busy} onClick={onSave}>
          存
        </Button>
        <Button variant="ghost" size="sm" fullWidth disabled={busy || !filled} onClick={onLoad}>
          读
        </Button>
        {filled ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            icon={<IconTrash size={13} />}
            onClick={onRemove}
          >
            <span className="sr-only">删除{slotLabel(slot)}</span>
          </Button>
        ) : null}
      </div>

      {busy ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[var(--color-bg)]/60">
          <Spinner size="sm" />
        </div>
      ) : null}
    </div>
  )
}

interface Props {
  rows: ReadonlyMap<SaveSlot, SaveStateRow>
  busySlot: SaveSlot | null
  onSave: (slot: SaveSlot) => void
  onLoad: (slot: SaveSlot) => void
  onRemove: (slot: SaveSlot) => void
}

/** 存读档面板。桌面塞进 Popover，移动端塞进 Sheet。 */
export function SaveSlotPanel({ rows, busySlot, onSave, onLoad, onRemove }: Props) {
  const auto = rows.get('auto')

  return (
    <div className="flex w-full flex-col gap-3 sm:w-[26rem]">
      {auto ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-2">
          <SlotThumb blob={auto.thumb} className="w-16" />
          <div className="min-w-0 flex-1">
            <p className="font-pixel text-[10px] text-[var(--color-text)]">自动存档</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-faint)]">
              {formatRelativeTime(auto.createdAt)}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={busySlot === 'auto'}
            onClick={() => onLoad('auto')}
          >
            读取
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SAVE_SLOTS.map((slot) => (
          <SlotCard
            key={String(slot)}
            slot={slot}
            row={rows.get(slot)}
            busy={busySlot === slot}
            onSave={() => onSave(slot)}
            onLoad={() => onLoad(slot)}
            onRemove={() => onRemove(slot)}
          />
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--color-text-faint)]">
        快捷键：Shift + 数字键存档，数字键读档。存档只保存在本机浏览器里。
      </p>
    </div>
  )
}
