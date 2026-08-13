import type { MouseEvent } from 'react'

import { IconStar, IconStarFilled } from '@/components/icons'
import { cn } from '@/lib/cn'
import type { GameView } from '@/types/game'

interface Props {
  game: GameView
  onToggle: (game: GameView) => void
  size?: number
  className?: string
}

/** 收藏星标。常驻显示，收藏过的才高亮，未收藏的只在悬停时浮现。 */
export function FavoriteButton({ game, onToggle, size = 16, className }: Props) {
  return (
    <button
      type="button"
      aria-label={game.favorite ? '取消收藏' : '加入收藏'}
      onClick={(event: MouseEvent) => {
        event.stopPropagation()
        onToggle(game)
      }}
      className={cn(
        'flex size-8 items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-surface-alt)]/90 transition-all',
        game.favorite
          ? 'text-[var(--color-warning)] opacity-100'
          : 'text-[var(--color-text-muted)] opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-[var(--color-warning)]',
        className,
      )}
    >
      {game.favorite ? <IconStarFilled size={size} /> : <IconStar size={size} />}
    </button>
  )
}
