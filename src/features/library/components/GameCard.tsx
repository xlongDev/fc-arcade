import { m } from 'motion/react'
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
export function GameCard({
  game,
  actions,
  animate,
  selected,
  selectionMode,
  variants,
}: GameItemProps) {
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

  const label = selectionMode ? `选择 ${title}` : `开始游戏 ${title}`

  const className = cn(
    'group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border bg-[var(--color-surface)] text-left outline-none transition-colors',
    selected
      ? 'border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent)]'
      : 'border-[var(--color-border)] hover:border-[var(--color-glass-border)]',
  )

  /** 整卡的主操作入口：透明拉伸按钮，覆盖整卡、位于封面与浮层按钮之下。
   *  这样 article 不再 role=button，内部播放/编辑/删除/收藏/多选按钮就不会形成
   *  无效的「按钮套按钮」，键盘也能依次聚焦。 */
  const hitArea = (
    <button
      type="button"
      aria-label={label}
      onClick={handleActivate}
      onKeyDown={onKeyDown}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="absolute inset-0 z-10 cursor-pointer rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]"
    />
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
      whileHover={{ y: -6 }}
      style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 900 }}
      className={className}
    >
      {hitArea}
      {children}
    </m.article>
  )
}
