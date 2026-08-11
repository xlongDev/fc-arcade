/**
 * 内存过滤与排序。
 * DAO 的 list() 与 store 的 useFilteredGames() 共用这里的实现，保证行为一致。
 */
import type { GameView } from '@/types/game'
import type { GameQuery, GameSortKey } from '@/types/storage'

/** 关键词按空白拆成多个词，全部命中才算匹配（AND 语义） */
function matchKeyword(view: GameView, tokens: string[], searchText: string): boolean {
  if (tokens.length === 0) return true
  const haystack = `${searchText} ${view.title} ${view.titleAlias ?? ''} ${view.fileName}`.toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

export interface FilterInput {
  keyword?: string
  categories?: readonly string[]
  yearRange?: readonly [number, number] | null
  favoriteOnly?: boolean
}

/**
 * 过滤。searchText 是写入时预计算的（含中文别名与拼音首字母），
 * 由调用方通过 searchTextOf 提供——GameView 上没有这个字段。
 */
export function filterGames(
  views: readonly GameView[],
  input: FilterInput,
  searchTextOf: (view: GameView) => string,
): GameView[] {
  const tokens = (input.keyword ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const categories = input.categories ?? []
  const range = input.yearRange ?? null

  return views.filter((view) => {
    if (input.favoriteOnly && !view.favorite) return false
    if (categories.length > 0 && !view.categories.some((c) => categories.includes(c))) return false
    if (range) {
      if (view.year === null) return false
      if (view.year < range[0] || view.year > range[1]) return false
    }
    return matchKeyword(view, tokens, searchTextOf(view))
  })
}

function compareBy(a: GameView, b: GameView, key: GameSortKey): number {
  switch (key) {
    case 'title':
      return a.title.localeCompare(b.title, 'zh-CN')
    case 'year':
      // 年份未知的排到最后（升序时也一样），避免一堆 null 挤在前面
      if (a.year === b.year) return 0
      if (a.year === null) return 1
      if (b.year === null) return -1
      return a.year - b.year
    case 'lastPlayedAt': {
      const av = a.lastPlayedAt ?? 0
      const bv = b.lastPlayedAt ?? 0
      return av - bv
    }
    case 'addedAt':
      return a.addedAt - b.addedAt
    case 'playCount':
      return a.playCount - b.playCount
    case 'totalPlayMs':
      return a.totalPlayMs - b.totalPlayMs
  }
}

export function sortGames(
  views: readonly GameView[],
  sortBy: GameSortKey = 'addedAt',
  sortDir: 'asc' | 'desc' = 'desc',
): GameView[] {
  const dir = sortDir === 'asc' ? 1 : -1
  const sorted = [...views]
  sorted.sort((a, b) => {
    const primary = compareBy(a, b, sortBy)
    if (primary !== 0) return primary * dir
    // 稳定的次级排序，避免同值时顺序抖动
    return a.title.localeCompare(b.title, 'zh-CN')
  })
  return sorted
}

/** 把 GameQuery 拆成过滤 + 排序 + 分页三步应用到视图数组上 */
export function applyGameQuery(
  views: readonly GameView[],
  query: GameQuery,
  searchTextOf: (view: GameView) => string,
): GameView[] {
  const filtered = filterGames(
    views,
    {
      keyword: query.keyword,
      categories: query.categories,
      yearRange: query.yearRange,
      favoriteOnly: query.favoriteOnly,
    },
    searchTextOf,
  )
  const sorted = sortGames(filtered, query.sortBy, query.sortDir)
  const offset = query.offset ?? 0
  const limit = query.limit
  if (offset === 0 && limit === undefined) return sorted
  return sorted.slice(offset, limit === undefined ? undefined : offset + limit)
}
