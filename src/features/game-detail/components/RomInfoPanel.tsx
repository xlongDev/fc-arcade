import { Badge } from '@/components/ui'
import { formatBytes, formatDuration, formatRelativeTime } from '@/lib/format'
import type { GameView, Mirroring, RomFormat } from '@/types/game'
import { CONFIDENCE_LABEL } from '@/types/game'

const MIRRORING_LABEL: Readonly<Record<Mirroring, string>> = {
  horizontal: '水平镜像',
  vertical: '垂直镜像',
  'four-screen': '四屏',
}

const FORMAT_LABEL: Readonly<Record<RomFormat, string>> = {
  ines: 'iNES 1.0',
  nes2: 'NES 2.0',
  raw: '无文件头',
}

/** 每 bank：PRG 16KB，CHR 8KB */
function bankSize(banks: number, kbPerBank: number): string {
  return `${banks} × ${kbPerBank}KB = ${banks * kbPerBank}KB`
}

interface RowProps {
  label: string
  value: string
  mono?: boolean
}

function Row({ label, value, mono = false }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-border)]/60 py-2 last:border-b-0">
      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{label}</span>
      <span
        className={
          mono
            ? 'truncate font-pixel text-[11px] tracking-wide text-[var(--color-text)]'
            : 'truncate text-sm text-[var(--color-text)]'
        }
      >
        {value}
      </span>
    </div>
  )
}

interface Props {
  game: GameView
}

/** ROM 静态信息 + 游玩统计。全部只读。 */
export function RomInfoPanel({ game }: Props) {
  const { rom } = game

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h4 className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">ROM 信息</h4>
        <Row label="文件名" value={game.fileName} />
        <Row label="CRC32" value={rom.crc32.toUpperCase()} mono />
        <Row label="文件格式" value={FORMAT_LABEL[rom.format]} />
        <Row label="Mapper" value={`#${rom.mapper}`} mono />
        <Row label="PRG ROM" value={bankSize(rom.prgBanks, 16)} />
        <Row
          label="CHR ROM"
          value={rom.chrBanks === 0 ? 'CHR RAM（无 CHR ROM）' : bankSize(rom.chrBanks, 8)}
        />
        <Row label="镜像方式" value={MIRRORING_LABEL[rom.mirroring]} />
        <Row label="文件大小" value={formatBytes(rom.sizeBytes)} />
      </section>

      <section className="flex flex-wrap gap-1.5">
        <Badge variant={rom.hasBattery ? 'success' : 'default'} size="sm">
          {rom.hasBattery ? '有电池存档' : '无电池存档'}
        </Badge>
        {rom.hasTrainer ? (
          <Badge variant="warning" size="sm">
            含 Trainer 数据
          </Badge>
        ) : null}
        <Badge variant="default" size="sm">
          识别：{CONFIDENCE_LABEL[game.confidence]}
        </Badge>
        {game.matchedTitleId ? (
          <Badge variant="info" size="sm">
            命中标题库
          </Badge>
        ) : null}
      </section>

      <section>
        <h4 className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">游玩统计</h4>
        <Row label="游玩次数" value={`${game.playCount} 次`} />
        <Row label="累计时长" value={game.totalPlayMs > 0 ? formatDuration(game.totalPlayMs) : '—'} />
        <Row label="最近游玩" value={formatRelativeTime(game.lastPlayedAt)} />
        <Row label="加入时间" value={new Date(game.addedAt).toLocaleString('zh-CN')} />
      </section>
    </div>
  )
}
