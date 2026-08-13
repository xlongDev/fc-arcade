import { motion } from 'motion/react'
import type { KeyboardEvent } from 'react'

import { displayTitle } from '@/features/common/lib/gameDisplay'
import { SPRING } from '@/features/common/motion'
import { cn } from '@/lib/cn'

import type { GameItemProps } from '../types'
import { FavoriteButton } from './FavoriteButton'
import { GameCover } from './GameCover'
import { SelectMark } from './SelectMark'

/**
 * 卡带架布局的单张卡带。
 * 造型模仿 FC 卡带：上方一块贴纸（封面），下方是带凹槽的塑料壳体。
 */
export function ShelfCard({ game, actions, animate, selected, selectionMode }: GameItemProps) {
  const title = displayTitle(game)

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
    'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-t-2xl rounded-b-lg border-2 outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
    selected
      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
      : 'border-[var(--color-border)] bg-[var(--color-surface-alt)]',
  )

  const children = (
    <>
      {/* 卡带顶部的握把凹槽 */}
      <span className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-[var(--color-border)]" />

      <div className="relative mx-2.5 mt-2 overflow-hidden rounded-lg border border-[var(--color-border)]">
        <div className="aspect-[4/3] w-full">
          <GameCover game={game} className="size-full" />
        </div>
        <div className="absolute top-1.5 right-1.5 z-30">
          <FavoriteButton game={game} onToggle={actions.onToggleFavorite} size={13} />
        </div>
        <div className="absolute top-1.5 left-1.5 z-30">
          <SelectMark
            game={game}
            selected={selected}
            visible={selectionMode}
            onToggle={actions.onToggleSelect}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between px-2.5 py-2.5">
        <p className="line-clamp-2 text-[11px] leading-tight font-medium text-[var(--color-text)]">
          {title}
        </p>
        <div className="mt-2 flex items-center gap-1">
          <span className="h-1 flex-1 rounded-full bg-[var(--color-border)]" />
          <span className="h-1 flex-1 rounded-full bg-[var(--color-border)]" />
          <span className="h-1 flex-1 rounded-full bg-[var(--color-border)]" />
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
      whileHover={{ y: -10, rotateZ: -1 }}
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
