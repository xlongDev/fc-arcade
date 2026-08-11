import type { MouseEvent } from 'react'

import { IconCheck } from '@/components/icons'
import { cn } from '@/lib/cn'
import type { GameView } from '@/types/game'

interface Props {
  game: GameView
  selected: boolean
  visible: boolean
  onToggle: (game: GameView) => void
}

/** 多选标记。非选择模式下悬停才出现，避免常态界面被复选框塞满。 */
export function SelectMark({ game, selected, visible, onToggle }: Props) {
  return (
    <button
      type="button"
      aria-label={selected ? '取消选择' : '选择这个游戏'}
      aria-pressed={selected}
      onClick={(event: MouseEvent) => {
        event.stopPropagation()
        onToggle(game)
      }}
      className={cn(
        'flex size-7 items-center justify-center rounded-full border-2 backdrop-blur-md transition-all',
        selected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]'
          : 'border-[var(--color-glass-border)] bg-[var(--color-glass)] text-transparent hover:border-[var(--color-accent)]',
        visible || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}
    >
      <IconCheck size={14} />
    </button>
  )
}
