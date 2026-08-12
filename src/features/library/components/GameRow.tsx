import type { MouseEvent } from 'react'
import { motion } from 'motion/react'

import { Badge, IconButton } from '@/components/ui'
import { IconEdit, IconPlay, IconTrash } from '@/components/icons'
import { displaySubtitle, displayTitle } from '@/features/common/lib/gameDisplay'
import { SPRING } from '@/features/common/motion'
import { cn } from '@/lib/cn'
import { formatDuration, formatRelativeTime } from '@/lib/format'
import { CATEGORY_LABEL } from '@/types/game'

import type { GameItemProps } from '../types'
import { FavoriteButton } from './FavoriteButton'
import { GameCover } from './GameCover'
import { SelectMark } from './SelectMark'

/** 阻止事件冒泡后再执行回调（纯函数，不依赖组件作用域） */
function stopPropagation(event: MouseEvent, run: () => void): void {
  event.stopPropagation()
  run()
}

/** 列表布局的单行 */
export function GameRow({ game, actions, animate, selected, selectionMode }: GameItemProps) {
  const title = displayTitle(game)
  const subtitle = displaySubtitle(game)

  const handleActivate = () => {
    if (selectionMode) actions.onToggleSelect(game)
    else actions.onPlay(game)
  }

  return (
    <motion.div
      layout={animate ? 'position' : false}
      layoutId={animate ? `game-${game.id}` : undefined}
      transition={SPRING}
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
        'group flex h-20 cursor-pointer items-center gap-3 rounded-2xl border px-3 outline-none transition-colors sm:gap-4 sm:px-4',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
        selected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/8'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-alt)]',
      )}
    >
      <SelectMark
        game={game}
        selected={selected}
        visible={selectionMode}
        onToggle={actions.onToggleSelect}
      />

      <GameCover
        game={game}
        showTitle={false}
        className="h-14 w-[74px] shrink-0 rounded-xl"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--color-text)]">{title}</p>
          {game.categories.length > 0 ? (
            <Badge variant="default" size="sm">
              {CATEGORY_LABEL[game.categories[0]]}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--color-text-faint)]">
          {subtitle ? `${subtitle} · ` : ''}
          {game.year ?? '年份未知'}
          {game.publisher ? ` · ${game.publisher}` : ''}
        </p>
      </div>

      <div className="hidden w-28 shrink-0 flex-col items-end lg:flex">
        <span className="text-xs text-[var(--color-text-muted)]">
          {formatRelativeTime(game.lastPlayedAt)}
        </span>
        <span className="text-[10px] text-[var(--color-text-faint)]">
          {game.playCount > 0 ? `${game.playCount} 次 · ${formatDuration(game.totalPlayMs)}` : '未玩过'}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <FavoriteButton game={game} onToggle={actions.onToggleFavorite} />
        <IconButton
          label="开始游戏"
          size="sm"
          variant="solid"
          onClick={(event: MouseEvent) => stopPropagation(event, () => actions.onPlay(game))}
        >
          <IconPlay size={14} />
        </IconButton>
        <IconButton
          label="编辑游戏信息"
          size="sm"
          variant="ghost"
          onClick={(event: MouseEvent) => stopPropagation(event, () => actions.onDetail(game))}
        >
          <IconEdit size={14} />
        </IconButton>
        <IconButton
          label="删除游戏"
          size="sm"
          variant="ghost"
          onClick={(event: MouseEvent) => stopPropagation(event, () => actions.onDelete(game))}
        >
          <IconTrash size={14} />
        </IconButton>
      </div>
    </motion.div>
  )
}
