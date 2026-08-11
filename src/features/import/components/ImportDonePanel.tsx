import { motion } from 'motion/react'

import { IconCheck } from '@/components/icons'
import { SPRING } from '@/features/common/motion'
import type { ImportResult } from '@/types/game'

interface Props {
  result: ImportResult
}

export function ImportDonePanel({ result }: Props) {
  return (
    <div className="flex flex-col items-center gap-5 py-10 text-center">
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING}
        className="flex size-16 items-center justify-center rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]"
      >
        <IconCheck size={32} />
      </motion.span>

      <div>
        <p className="font-pixel text-base text-[var(--color-text)]">导入完成</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          成功导入 {result.imported} 个游戏
          {result.skipped > 0 ? `，跳过 ${result.skipped} 个重复项` : ''}
          {result.failed > 0 ? `，${result.failed} 个失败` : ''}。
        </p>
      </div>
    </div>
  )
}
