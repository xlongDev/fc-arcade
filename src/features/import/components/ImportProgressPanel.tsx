import { ProgressBar } from '@/components/ui'
import type { ImportProgress, ImportStage } from '@/types/game'

const STAGE_LABEL: Readonly<Record<ImportStage, string>> = {
  reading: '读取文件',
  parsing: '解析 ROM 头',
  matching: '匹配标题库',
  writing: '写入游戏库',
  done: '完成',
  error: '出错',
}

interface Props {
  progress: ImportProgress | null
}

export function ImportProgressPanel({ progress }: Props) {
  const total = progress?.total ?? 0
  const processed = progress?.processed ?? 0
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0

  return (
    <div className="flex flex-col gap-4 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-[var(--color-text)]">
          {progress ? STAGE_LABEL[progress.stage] : '准备中'}
        </span>
        <span className="font-pixel text-xs text-[var(--color-text-muted)]">
          {processed} / {total || '?'}
        </span>
      </div>

      <ProgressBar value={percent} indeterminate={total === 0} />

      <p className="min-h-5 truncate text-xs text-[var(--color-text-faint)]">
        {progress?.currentFile ?? '正在枚举文件…'}
      </p>
    </div>
  )
}
