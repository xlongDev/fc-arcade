import { Tooltip } from '@/components/ui'
import { IconChip } from '@/components/icons'
import { useStorageUsage } from '@/features/common/hooks/useStorageUsage'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'

/** 导航栏右侧的存储用量胶囊。数据来自 navigator.storage.estimate()，只是估算。 */
export function StorageMeter({ className }: { className?: string }) {
  const { usage } = useStorageUsage()

  if (!usage) return null

  const ratio = usage.quota > 0 ? Math.min(1, usage.usage / usage.quota) : 0
  const percent = Math.round(ratio * 100)
  const tone =
    ratio > 0.9
      ? 'var(--color-danger)'
      : ratio > 0.7
        ? 'var(--color-warning)'
        : 'var(--color-accent)'

  return (
    <Tooltip
      side="bottom"
      content={
        <div className="flex flex-col gap-1 text-xs">
          <span>
            已用 {formatBytes(usage.usage)} / {formatBytes(usage.quota)}（{percent}%）
          </span>
          <span className="text-[var(--color-text-faint)]">
            ROM {formatBytes(usage.breakdown.roms)} · 封面 {formatBytes(usage.breakdown.covers)} ·
            存档 {formatBytes(usage.breakdown.saveStates)}
          </span>
          <span className="text-[var(--color-text-faint)]">
            {usage.persisted ? '已开启持久化存储' : '未持久化，浏览器可能在空间不足时清理数据'}
          </span>
        </div>
      }
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass)] px-3 py-1.5',
          className,
        )}
      >
        <span className="text-[var(--color-text-muted)]">
          <IconChip size={14} />
        </span>
        <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
          <span
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
            style={{ width: `${Math.max(percent, 2)}%`, background: tone }}
          />
        </span>
        <span className="font-pixel text-[10px] text-[var(--color-text-muted)]">{percent}%</span>
      </div>
    </Tooltip>
  )
}
