import { useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup } from 'motion/react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'

import type { GameView } from '@/types/game'

import { GameRow } from '../components/GameRow'
import { LIST_ROW_GAP, LIST_ROW_HEIGHT } from '../layoutConfig'
import type { GameActions } from '../types'

interface Props {
  games: GameView[]
  actions: GameActions
  selectedIds: ReadonlySet<string>
  selectionMode: boolean
  animate: boolean
  virtualized: boolean
}

export function ListView({
  games,
  actions,
  selectedIds,
  selectionMode,
  animate,
  virtualized,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sync = () => setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  const virtualizer = useWindowVirtualizer({
    count: virtualized ? games.length : 0,
    estimateSize: () => LIST_ROW_HEIGHT + LIST_ROW_GAP,
    overscan: 6,
    scrollMargin,
  })

  const renderRow = (game: GameView) => (
    <GameRow
      key={game.id}
      game={game}
      actions={actions}
      animate={animate}
      selected={selectedIds.has(game.id)}
      selectionMode={selectionMode}
    />
  )

  if (!virtualized) {
    return (
      <div ref={containerRef}>
        <LayoutGroup>
          <div className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {games.map(renderRow)}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((item) => {
          const game = games[item.index]
          if (!game) return null
          return (
            <div
              key={item.key}
              className="absolute top-0 left-0 w-full contain-[layout_paint]"
              style={{
                height: `${LIST_ROW_HEIGHT}px`,
                transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              {renderRow(game)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
