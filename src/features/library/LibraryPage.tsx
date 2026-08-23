import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { Spinner } from '@/components/ui'
import { ConfirmDialog } from '@/features/common/components/ConfirmDialog'
import { useReduceMotion } from '@/features/common/hooks/useReduceMotion'
import { onLibraryChanged } from '@/features/common/lib/storageEvents'
import { useFilteredGames, useGames, useLibraryStore, useSettingsStore } from '@/store'

/**
 * 游戏详情弹窗懒加载：它连带把封面编辑器、@/metadata 的 reidentify 等一并引入，
 * 但只在用户点开某一款游戏时才需要，故移出首屏、按需在打开时拉取。
 */
const GameDetailDialog = lazy(async () => {
  const mod = await import('@/features/game-detail/GameDetailDialog')
  return { default: mod.GameDetailDialog }
})
import type { GameView } from '@/types/game'

import { FilteredEmpty, LibraryEmpty } from './components/LibraryEmpty'
import { LibraryToolbar } from './components/LibraryToolbar'
import { RecentRow } from './components/RecentRow'
import { SelectionBar } from './components/SelectionBar'
import { VIRTUALIZE_THRESHOLD } from './layoutConfig'
import { deleteConfirmText, useLibraryActions } from './useLibraryActions'
import type { GameActions } from './types'
import { GridView } from './views/GridView'
import { ListView } from './views/ListView'
import { ShelfView } from './views/ShelfView'

const RECENT_LIMIT = 8
const DEFAULT_YEAR_BOUNDS: [number, number] = [1983, 1996]

/** 布局切换转场：旧视图淡出缩小的同时新视图淡入放大 */
const layoutTransitionVariants = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -8 },
}

const layoutMotionProps = (reduce: boolean) => ({
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: layoutTransitionVariants,
  transition: reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.8 },
})

export function LibraryPage() {
  const { games: allGames, loading: loadingAll, refresh } = useGames()
  const { games, loading } = useFilteredGames()

  const layout = useSettingsStore((s) => s.settings.layout)
  const sortBy = useSettingsStore((s) => s.settings.sortBy)
  const sortDir = useSettingsStore((s) => s.settings.sortDir)
  const filter = useLibraryStore((s) => s.filter)
  const selection = useLibraryStore((s) => s.selection)
  const toggleSelect = useLibraryStore((s) => s.toggleSelect)
  const clearSelection = useLibraryStore((s) => s.clearSelection)

  const reduceMotion = useReduceMotion()
  const actions = useLibraryActions()

  const [selectionMode, setSelectionMode] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<GameView[]>([])

  useEffect(() => onLibraryChanged(refresh), [refresh])

  const selectedIds = useMemo(() => new Set(selection), [selection])

  const yearBounds = useMemo<[number, number]>(() => {
    const years = allGames.map((g) => g.year).filter((y): y is number => typeof y === 'number')
    if (years.length === 0) return DEFAULT_YEAR_BOUNDS
    return [Math.min(...years), Math.max(...years)]
  }, [allGames])

  const recent = useMemo(
    () =>
      allGames
        .filter((g) => g.lastPlayedAt !== null)
        .toSorted((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
        .slice(0, RECENT_LIMIT),
    [allGames],
  )

  const hasActiveFilter =
    filter.keyword.length > 0 ||
    filter.categories.length > 0 ||
    filter.yearRange !== null ||
    filter.favoriteOnly

  const virtualized = games.length > VIRTUALIZE_THRESHOLD
  const animate = !virtualized && !reduceMotion

  const gameActions = useMemo<GameActions>(
    () => ({
      onPlay: actions.play,
      onDetail: (game) => setDetailId(game.id),
      onDelete: (game) => setPendingDelete([game]),
      onToggleFavorite: (game) => void actions.toggleFavorite(game),
      onToggleSelect: (game) => toggleSelect(game.id),
    }),
    [actions, toggleSelect],
  )

  const detailGame = useMemo(
    () => allGames.find((g) => g.id === detailId) ?? null,
    [allGames, detailId],
  )

  const selectedGames = useMemo(
    () => allGames.filter((g) => selectedIds.has(g.id)),
    [allGames, selectedIds],
  )

  if (loadingAll && allGames.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (allGames.length === 0) return <LibraryEmpty />

  const confirmText = deleteConfirmText(pendingDelete)

  return (
    <div className="flex flex-col gap-6">
      {!hasActiveFilter && recent.length > 0 ? (
        <RecentRow games={recent} onPlay={actions.play} />
      ) : null}

      <div className="flex flex-col gap-4">
        <LibraryToolbar
          yearBounds={yearBounds}
          selectionMode={selectionMode || selection.length > 0}
          games={games}
          onToggleSelectionMode={() => {
            setSelectionMode((prev) => {
              if (prev) clearSelection()
              return !prev
            })
          }}
        />

        <p className="text-xs text-[var(--color-text-faint)]">
          共 {games.length} 个游戏
          {hasActiveFilter ? `（库内合计 ${allGames.length} 个）` : ''}
          {virtualized ? ' · 已启用虚拟滚动' : ''}
        </p>

        <AnimatePresence mode="wait">
          {loading && games.length === 0 ? (
            <motion.div key="loading" {...layoutMotionProps(reduceMotion)} className="flex min-h-[30vh] items-center justify-center">
              <Spinner />
            </motion.div>
          ) : games.length === 0 ? (
            <motion.div key="empty" {...layoutMotionProps(reduceMotion)}>
              <FilteredEmpty />
            </motion.div>
          ) : layout === 'list' ? (
            <motion.div key="list" {...layoutMotionProps(reduceMotion)}>
              <ListView
                games={games}
                actions={gameActions}
                selectedIds={selectedIds}
                selectionMode={selectionMode || selection.length > 0}
                animate={animate}
                virtualized={virtualized}
              />
            </motion.div>
          ) : layout === 'shelf' ? (
            <motion.div key="shelf" {...layoutMotionProps(reduceMotion)}>
              <ShelfView
                games={games}
                actions={gameActions}
                selectedIds={selectedIds}
                selectionMode={selectionMode || selection.length > 0}
                animate={animate}
                virtualized={virtualized}
              />
            </motion.div>
          ) : (
            <motion.div key={`${layout}-${sortBy}-${sortDir}`} {...layoutMotionProps(reduceMotion)}>
              <GridView
                games={games}
                layout={layout}
                actions={gameActions}
                selectedIds={selectedIds}
                selectionMode={selectionMode || selection.length > 0}
                animate={animate}
                virtualized={virtualized}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SelectionBar
        count={selection.length}
        busy={actions.busy}
        onFavorite={() => {
          const allFavorite = selectedGames.every((g) => g.favorite)
          void actions.favoriteMany(selection, !allFavorite)
        }}
        onDelete={() => setPendingDelete(selectedGames)}
        onClear={() => {
          clearSelection()
          setSelectionMode(false)
        }}
      />

      <ConfirmDialog
        open={pendingDelete.length > 0}
        title={confirmText.title}
        description={confirmText.description}
        confirmText="删除"
        danger
        loading={actions.busy}
        onCancel={() => setPendingDelete([])}
        onConfirm={() => {
          void actions.removeMany(pendingDelete.map((g) => g.id)).then(() => setPendingDelete([]))
        }}
      />

      {detailGame !== null ? (
        <Suspense fallback={null}>
          <GameDetailDialog game={detailGame} open onClose={() => setDetailId(null)} />
        </Suspense>
      ) : null}
    </div>
  )
}
