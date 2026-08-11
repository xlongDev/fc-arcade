import { GeneratedCover, useGameCover } from '@/cover'
import { Skeleton } from '@/components/ui'
import { displayTitle } from '@/features/common/lib/gameDisplay'
import { cn } from '@/lib/cn'
import type { GameView } from '@/types/game'

interface Props {
  game: GameView
  className?: string
  /** 程序化封面上是否绘制标题文字 */
  showTitle?: boolean
}

/**
 * 封面三层回退：custom / screenshot 走 IndexedDB 里的 blob，
 * 没有的话现场画一张程序化封面——同一标题在任何设备上结果一致。
 */
export function GameCover({ game, className, showTitle = true }: Props) {
  const title = displayTitle(game)
  const { url, loading } = useGameCover(game.id, title, game.coverKind)

  return (
    <div className={cn('relative overflow-hidden bg-[var(--color-surface-alt)]', className)}>
      {url ? (
        <img
          src={url}
          alt={title}
          loading="lazy"
          decoding="async"
          className="size-full object-cover [image-rendering:pixelated]"
        />
      ) : loading && game.coverKind !== 'generated' ? (
        <Skeleton className="size-full" />
      ) : (
        <GeneratedCover title={title} showTitle={showTitle} className="size-full" />
      )}
    </div>
  )
}
