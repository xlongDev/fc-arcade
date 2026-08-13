import { motion } from 'motion/react'
import type { KeyboardEvent } from 'react'

import { Badge } from '@/components/ui'
import { displaySubtitle, displayTitle } from '@/features/common/lib/gameDisplay'
import { SPRING } from '@/features/common/motion'
import { cn } from '@/lib/cn'
import { formatRelativeTime } from '@/lib/format'
import { CATEGORY_LABEL } from '@/types/game'

import type { GameItemProps } from '../types'
import { CardOverlay } from './CardOverlay'
import { FavoriteButton } from './FavoriteButton'
import { GameCover } from './GameCover'
import { SelectMark } from './SelectMark'
import { useTilt } from './useTilt'

/** 游戏库「大卡片」布局的主卡片 */
export function GameCard({ game, actions, animate, selected, selectionMode }: GameItemProps) {
  const tilt = useTilt(animate)
  const title = displayTitle(game)
  const subtitle = displaySubtitle(game)

  const handleActivate = () => {
    if (selectionMode) actions.onToggleSelect(game)
    else actions.onPlay(game)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleActivate()
    }
  }

  const className = cn(
    'group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border bg-[var(--color-surface)] text-left outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
    selected
      ? 'border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent)]'
      : 'border-[var(--color-border)] hover:border-[var(--color-glass-border)]',
  )

  const children = (
    <>
      <div className="relative aspect-[4/3] w-full">
        <GameCover game={game} className="size-full" />
        <CardOverlay game={game} actions={actions} />

        <div className="absolute top-2.5 left-2.5 z-30">
          <SelectMark
            game={game}
            selected={selected}
            visible={selectionMode}
            onToggle={actions.onToggleSelect}
          />
        </div>
        <div className="absolute top-2.5 right-2.5 z-30">
          <FavoriteButton game={game} onToggle={actions.onToggleFavorite} />
        </div>
      </div>

      <div className="flex h-[100px] flex-col gap-1.5 px-3.5 py-3">
        <p className="truncate text-sm font-medium text-[var(--color-text)]">{title}</p>
        {subtitle ? (
          <p className="truncate text-xs text-[var(--color-text-faint)]">{subtitle}</p>
        ) : null}

        <div className="mt-auto flex items-center gap-1.5 pt-1">
          {game.year ? (
            <span className="font-pixel text-[10px] text-[var(--color-text-muted)]">
              {game.year}
            </span>
          ) : null}
          {game.categories.length > 0 ? (
            <Badge variant="default" size="sm">
              {CATEGORY_LABEL[game.categories[0]]}
            </Badge>
          ) : null}
          <span className="ml-auto truncate text-[10px] text-[var(--color-text-faint)]">
            {formatRelativeTime(game.lastPlayedAt)}
          </span>
        </div>
      </div>
    </>
  )

  if (!animate) {
    return (
      <article
        className={className}
        onClick={handleActivate}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${title}，回车开始游戏`}
      >
        {children}
      </article>
    )
  }

  return (
    <motion.article
      layout="position"
      layoutId={`game-${game.id}`}
      transition={SPRING}
      whileHover={{ y: -6 }}
      style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 900 }}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      onClick={handleActivate}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${title}，回车开始游戏`}
      className={className}
    >
      {children}
    </motion.article>
  )
}
