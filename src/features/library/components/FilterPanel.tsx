import { Button, Slider, Switch } from '@/components/ui'
import { useLibraryStore } from '@/store'
import { cn } from '@/lib/cn'
import { CATEGORY_LABEL, GAME_CATEGORIES } from '@/types/game'
import type { GameCategory } from '@/types/game'

interface Props {
  /** 库内实际存在的年份范围，滑块不该超出真实数据 */
  yearBounds: [number, number]
}

/** 筛选面板内容。桌面塞进 Popover，移动端塞进 Sheet，内容完全一致。 */
export function FilterPanel({ yearBounds }: Props) {
  const filter = useLibraryStore((s) => s.filter)
  const setFilter = useLibraryStore((s) => s.setFilter)
  const resetFilter = useLibraryStore((s) => s.resetFilter)

  const [minYear, maxYear] = yearBounds
  const range = filter.yearRange ?? yearBounds

  const toggleCategory = (category: GameCategory) => {
    const next = filter.categories.includes(category)
      ? filter.categories.filter((c) => c !== category)
      : [...filter.categories, category]
    setFilter({ categories: next })
  }

  const setRange = (index: 0 | 1, value: number) => {
    const next: [number, number] = index === 0 ? [value, range[1]] : [range[0], value]
    if (next[0] > next[1]) next[index === 0 ? 1 : 0] = value
    setFilter({ yearRange: next })
  }

  return (
    <div className="flex w-full flex-col gap-5 sm:w-80">
      <section className="flex flex-col gap-2.5">
        <p className="text-xs font-medium text-[var(--color-text-muted)]">分类</p>
        <div className="flex flex-wrap gap-1.5">
          {GAME_CATEGORIES.map((category) => {
            const active = filter.categories.includes(category)
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
                onClick={() => toggleCategory(category)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  active
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]',
                )}
              >
                {CATEGORY_LABEL[category]}
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">发行年代</p>
          <span className="font-pixel text-[10px] text-[var(--color-text-faint)]">
            {range[0]} – {range[1]}
          </span>
        </div>
        <Slider
          value={range[0]}
          onChange={(value: number) => setRange(0, value)}
          min={minYear}
          max={maxYear}
          step={1}
          label="起始年份"
          formatValue={(value: number) => `${value}`}
        />
        <Slider
          value={range[1]}
          onChange={(value: number) => setRange(1, value)}
          min={minYear}
          max={maxYear}
          step={1}
          label="结束年份"
          formatValue={(value: number) => `${value}`}
        />
      </section>

      <section>
        <Switch
          checked={filter.favoriteOnly}
          onChange={(next: boolean) => setFilter({ favoriteOnly: next })}
          label="只看收藏"
        />
      </section>

      <Button variant="ghost" size="sm" fullWidth onClick={resetFilter}>
        清空筛选条件
      </Button>
    </div>
  )
}
