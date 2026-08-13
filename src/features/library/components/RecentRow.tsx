import { motion } from 'motion/react'

import { IconClock, IconPlay } from '@/components/icons'
import { displayTitle } from '@/features/common/lib/gameDisplay'
import { SPRING } from '@/features/common/motion'
import { formatRelativeTime } from '@/lib/format'
import type { GameView } from '@/types/game'

import { GameCover } from './GameCover'

interface Props {
  games: GameView[]
  onPlay: (game: GameView) => void
}

/** 顶部「继续游玩」横向卡片行。没有游玩记录时整块不渲染。 */
export function RecentRow({ games, onPlay }: Props) {
  if (games.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)]">
        <IconClock size={15} />
        继续游玩
      </h2>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {games.map((game) => (
          <motion.button
            key={game.id}
            type="button"
            onClick={() => onPlay(game)}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING}
            className="group relative flex w-[248px] shrink-0 items-center gap-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-left"
          >
            <GameCover
              game={game}
              className="h-16 w-[86px] shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-text)]">
                {displayTitle(game)}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--color-text-faint)]">
                {formatRelativeTime(game.lastPlayedAt)}
              </p>
            </div>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] opacity-0 transition-opacity group-hover:opacity-100">
              <IconPlay size={14} />
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  )
}
