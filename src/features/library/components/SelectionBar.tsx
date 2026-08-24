import { AnimatePresence, m } from 'motion/react'

import { Button } from '@/components/ui'
import { IconClose, IconStarFilled, IconTrash } from '@/components/icons'
import { SPRING } from '@/features/common/motion'

interface Props {
  count: number
  busy: boolean
  onFavorite: () => void
  onDelete: () => void
  onClear: () => void
}

/** 多选状态下浮在底部的批量操作条 */
export function SelectionBar({ count, busy, onFavorite, onDelete, onClear }: Props) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <m.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={SPRING}
          className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-6"
        >
          <div className="flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass)] px-3 py-2 backdrop-blur-[var(--glass-blur)]">
            <span className="px-2 font-pixel text-[11px] text-[var(--color-text)]">
              已选 {count} 个
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<IconStarFilled size={14} />}
              loading={busy}
              onClick={onFavorite}
            >
              收藏
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<IconTrash size={14} />}
              loading={busy}
              onClick={onDelete}
            >
              删除
            </Button>
            <Button variant="ghost" size="sm" icon={<IconClose size={14} />} onClick={onClear}>
              取消
            </Button>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}
