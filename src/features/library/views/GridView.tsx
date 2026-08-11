import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup } from 'motion/react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'

import type { GameView } from '@/types/game'

import { CompactCard } from '../components/CompactCard'
import { GameCard } from '../components/GameCard'
import { computeColumns, GRID_CONFIG } from '../layoutConfig'
import type { GameActions } from '../types'

interface Props {
  games: GameView[]
  layout: 'grid' | 'compact' | 'wall'
  actions: GameActions
  selectedIds: ReadonlySet<string>
  selectionMode: boolean
  /** false 时关闭 layout 动画，交给虚拟化保证帧率 */
  animate: boolean
  virtualized: boolean
}

export function GridView({
  games,
  layout,
  actions,
  selectedIds,
  selectionMode,
  animate,
  virtualized,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const config = GRID_CONFIG[layout]

  const [width, setWidth] = useState(0)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sync = () => {
      setWidth(el.clientWidth)
      setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    window.addEventListener('resize', sync)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [])

  const columns = computeColumns(width, config)
  const columnWidth =
    columns > 0 ? (width - config.gap * (columns - 1)) / columns : config.minItemWidth
  const rowHeight = columnWidth / config.coverAspect + config.metaHeight + config.gap
  const rowCount = Math.ceil(games.length / columns)

  const virtualizer = useWindowVirtualizer({
    count: virtualized ? rowCount : 0,
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin,
  })

  const gridStyle = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: `${config.gap}px`,
    }),
    [columns, config.gap],
  )

  const renderItem = (game: GameView) => {
    const shared = {
      key: game.id,
      game,
      actions,
      animate,
      selected: selectedIds.has(game.id),
      selectionMode,
    }
    if (layout === 'grid') return <GameCard {...shared} />
    return <CompactCard {...shared} variant={layout} />
  }

  if (!virtualized) {
    return (
      <div ref={containerRef}>
        <LayoutGroup>
          <div style={gridStyle}>
            <AnimatePresence mode="popLayout" initial={false}>
              {games.map(renderItem)}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </div>
    )
  }

  return (
    <div ref={containerRef}>
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((row) => {
          const start = row.index * columns
          const slice = games.slice(start, start + columns)
          return (
            <div
              key={row.key}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${row.size}px`,
                transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <div style={gridStyle}>{slice.map(renderItem)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
