import { m } from 'motion/react'
import type { KeyboardEvent } from 'react'

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
  variants,
}: Props) {
  const title = displayTitle(game)
  const isWall = variant === 'wall'

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

  const label = selectionMode ? `选择 ${title}` : `开始游戏 ${title}`

  const className = cn(
    'group relative flex cursor-pointer flex-col overflow-hidden outline-none transition-colors',
    isWall
      ? 'rounded-none'
      : cn(
          'rounded-2xl border bg-[var(--color-surface)]',
          selected ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]',
        ),
    isWall && selected ? 'ring-2 ring-[var(--color-accent)] ring-inset' : null,
  )

  /** 整卡主操作入口：透明拉伸按钮，覆盖整卡、位于浮层按钮之下，避免「按钮套按钮」 */
  const hitArea = (
    <button
      type="button"
      aria-label={label}
      onClick={handleActivate}
      onKeyDown={onKeyDown}
      className={cn(
        'absolute inset-0 z-10 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]',
        isWall && 'rounded-none',
      )}
    />
  )

  const children = (
    <>
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
    </>
  )

  if (!animate) {
    return (
      <article role="group" className={className}>
        {hitArea}
        {children}
      </article>
    )
  }

  return (
    <m.article
      layout="position"
      layoutId={`game-${game.id}`}
      transition={SPRING}
      variants={variants}
      whileHover={isWall ? undefined : { y: -4 }}
      className={className}
    >
      {hitArea}
      {children}
    </m.article>
  )
}
