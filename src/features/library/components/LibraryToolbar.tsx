import { useMemo, useState } from 'react'

import { Badge, Button, IconButton, Popover, SegmentedControl, Select, Sheet } from '@/components/ui'
import {
  IconCompact,
  IconFilter,
  IconGrid,
  IconList,
  IconSelect,
  IconSelectAll,
  IconShelf,
  IconSort,
  IconWall,
} from '@/components/icons'
import { useIsCompactViewport } from '@/features/common/hooks/useMediaQuery'
import { useLibraryStore, useSettingsStore } from '@/store'
import { LAYOUT_LABEL, LIBRARY_LAYOUTS, SORT_LABEL } from '@/types/ui'
import type { LibraryLayout } from '@/types/ui'
import type { GameSortKey } from '@/types/storage'
import type { GameView } from '@/types/game'

import { FilterPanel } from './FilterPanel'
import { LibrarySearchField } from './LibrarySearchField'

const LAYOUT_ICON: Readonly<Record<LibraryLayout, React.ReactNode>> = {
  grid: <IconGrid size={15} />,
  compact: <IconCompact size={15} />,
  list: <IconList size={15} />,
  wall: <IconWall size={15} />,
  shelf: <IconShelf size={15} />,
}

const SORT_KEYS: readonly GameSortKey[] = [
  'lastPlayedAt',
  'addedAt',
  'title',
  'year',
  'playCount',
  'totalPlayMs',
]

interface Props {
  yearBounds: [number, number]
  selectionMode: boolean
  onToggleSelectionMode: () => void
  /** 当前过滤后的游戏列表，用于「全选」只选中可见项 */
  games: readonly GameView[]
}

export function LibraryToolbar({ yearBounds, selectionMode, onToggleSelectionMode, games }: Props) {
  const settings = useSettingsStore((s) => s.settings)
  const setSetting = useSettingsStore((s) => s.setSetting)
  const filter = useLibraryStore((s) => s.filter)
  const selection = useLibraryStore((s) => s.selection)
  const setSelection = useLibraryStore((s) => s.setSelection)
  const compactViewport = useIsCompactViewport()
  const [sheetOpen, setSheetOpen] = useState(false)

  const gameIds = useMemo(() => games.map((g) => g.id), [games])
  const selectedVisibleCount = useMemo(
    () => gameIds.filter((id) => selection.includes(id)).length,
    [gameIds, selection],
  )
  const allVisibleSelected = selectedVisibleCount > 0 && selectedVisibleCount === gameIds.length

  const activeFilters =
    filter.categories.length + (filter.yearRange ? 1 : 0) + (filter.favoriteOnly ? 1 : 0)

  const filterButton = (
    <Button
      variant={activeFilters > 0 ? 'primary' : 'secondary'}
      size="sm"
      icon={<IconFilter size={15} />}
      onClick={compactViewport ? () => setSheetOpen(true) : undefined}
    >
      筛选
      {activeFilters > 0 ? (
        <Badge variant="accent" size="sm">
          {activeFilters}
        </Badge>
      ) : null}
    </Button>
  )

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <LibrarySearchField className="w-full md:hidden" />

      <SegmentedControl
        value={settings.layout}
        onChange={(next: LibraryLayout) => setSetting('layout', next)}
        options={LIBRARY_LAYOUTS.map((layout) => ({
          value: layout,
          label: LAYOUT_LABEL[layout],
          icon: LAYOUT_ICON[layout],
        }))}
      />

      <div className="ml-auto flex items-center gap-2">
        <div className="w-36">
          <Select
            value={settings.sortBy}
            onChange={(next: GameSortKey) => setSetting('sortBy', next)}
            options={SORT_KEYS.map((key) => ({ value: key, label: SORT_LABEL[key] }))}
          />
        </div>

        <IconButton
          label={settings.sortDir === 'desc' ? '当前降序，点击改为升序' : '当前升序，点击改为降序'}
          size="sm"
          variant="ghost"
          active={settings.sortDir === 'asc'}
          onClick={() => setSetting('sortDir', settings.sortDir === 'desc' ? 'asc' : 'desc')}
        >
          <IconSort size={15} />
        </IconButton>

        {compactViewport ? (
          filterButton
        ) : (
          <Popover trigger={filterButton} side="bottom" align="end">
            <FilterPanel yearBounds={yearBounds} />
          </Popover>
        )}

        <IconButton
          label={selectionMode ? '退出多选' : '进入多选'}
          size="sm"
          variant={selectionMode ? 'solid' : 'ghost'}
          active={selectionMode}
          onClick={onToggleSelectionMode}
        >
          <IconSelect size={15} />
        </IconButton>

        <IconButton
          label={allVisibleSelected ? '取消全选' : '全选'}
          size="sm"
          variant="ghost"
          disabled={!selectionMode || games.length === 0}
          onClick={() => {
            if (allVisibleSelected) {
              setSelection([])
            } else {
              setSelection(gameIds)
            }
          }}
        >
          <IconSelectAll size={15} />
        </IconButton>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="筛选">
        <FilterPanel yearBounds={yearBounds} />
      </Sheet>
    </div>
  )
}
