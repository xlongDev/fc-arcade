import { useRef } from 'react'
import { LayoutGroup } from 'motion/react'
import { useVirtualizer } from '@tanstack/react-virtual'

import type { GameView } from '@/types/game'

import { ShelfCard } from '../components/ShelfCard'
import { SHELF_GAP, SHELF_ITEM_WIDTH } from '../layoutConfig'
import type { GameActions } from '../types'

interface Props {
  games: GameView[]
  actions: GameActions
  selectedIds: ReadonlySet<string>
  selectionMode: boolean
  animate: boolean
  virtualized: boolean
}

/** 横向滚动的卡带架。数量多时走横向虚拟化，滚动容器是它自己而不是窗口。 */
export function ShelfView({
  games,
  actions,
  selectedIds,
  selectionMode,
  animate,
  virtualized,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    horizontal: true,
    count: virtualized ? games.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => SHELF_ITEM_WIDTH + SHELF_GAP,
    overscan: 5,
  })

  const renderCard = (game: GameView) => (
    <ShelfCard
      key={game.id}
      game={game}
      actions={actions}
      animate={animate}
      selected={selectedIds.has(game.id)}
      selectionMode={selectionMode}
    />
  )

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden pb-6 [scrollbar-width:thin]"
      >
        {virtualized ? (
          <div
            className="relative h-[290px]"
            style={{ width: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const game = games[item.index]
              if (!game) return null
              return (
              <div
                key={item.key}
                className="absolute top-0 left-0 h-full contain-[layout_paint]"
                style={{
                  width: `${SHELF_ITEM_WIDTH}px`,
                  transform: `translateX(${item.start}px)`,
                }}
              >
                  {renderCard(game)}
                </div>
              )
            })}
          </div>
        ) : (
          <LayoutGroup>
            <div className="flex h-[290px] items-stretch" style={{ gap: `${SHELF_GAP}px` }}>
              {games.map((game) => (
                <div key={game.id} style={{ width: `${SHELF_ITEM_WIDTH}px`, flex: '0 0 auto' }}>
                  {renderCard(game)}
                </div>
              ))}
            </div>
          </LayoutGroup>
        )}
      </div>

      {/* 木质架板 */}
      <div className="h-3 rounded-full bg-gradient-to-b from-[var(--color-border)] to-transparent" />
    </div>
  )
}
