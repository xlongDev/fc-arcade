import { motion } from 'motion/react'

import { displayTitle } from '@/features/common/lib/gameDisplay'
import { SPRING } from '@/features/common/motion'
import { cn } from '@/lib/cn'

import type { GameItemProps } from '../types'
import { CardOverlay } from './CardOverlay'
import { FavoriteButton } from './FavoriteButton'
import { GameCover } from './GameCover'
import { SelectMark } from './SelectMark'

interface Props extends GameItemProps {
  /** wall 模式无圆角无间隙，纯拼贴 */
  variant: 'compact' | 'wall'
}

/** 紧凑网格与封面墙共用的小卡片 */
export function CompactCard({
  game,
  actions,
  animate,
  selected,
  selectionMode,
  variant,
}: Props) {
  const title = displayTitle(game)
  const isWall = variant === 'wall'

  const handleActivate = () => {
    if (selectionMode) actions.onToggleSelect(game)
    else actions.onPlay(game)
  }

  return (
    <motion.article
      layout={animate ? 'position' : false}
      layoutId={animate ? `game-${game.id}` : undefined}
      transition={SPRING}
      whileHover={animate && !isWall ? { y: -4 } : undefined}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleActivate()
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${title}，回车开始游戏`}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset',
        isWall
          ? 'rounded-none'
          : cn(
              'rounded-2xl border bg-[var(--color-surface)]',
              selected ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]',
            ),
        isWall && selected ? 'ring-2 ring-[var(--color-accent)] ring-inset' : null,
      )}
    >
      <div className="relative aspect-[4/3] w-full">
        <GameCover game={game} className="size-full" showTitle={!isWall} />
        <CardOverlay game={game} actions={actions} compact />

        <div className="absolute top-1.5 left-1.5 z-30">
          <SelectMark
            game={game}
            selected={selected}
            visible={selectionMode}
            onToggle={actions.onToggleSelect}
          />
        </div>
        <div className="absolute top-1.5 right-1.5 z-30">
          <FavoriteButton game={game} onToggle={actions.onToggleFavorite} size={13} />
        </div>

        {isWall ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[var(--color-bg)]/90 to-transparent px-2 pt-6 pb-2 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="truncate text-[11px] font-medium text-[var(--color-text)]">{title}</p>
          </div>
        ) : null}
      </div>

      {isWall ? null : (
        <p className="truncate px-2 py-2 text-[11px] text-[var(--color-text)]">{title}</p>
      )}
    </motion.article>
  )
}
