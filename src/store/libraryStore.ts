/**
 * 游戏库页面的瞬时 UI 状态：搜索词、筛选条件、多选集合。
 *
 * 刻意不做持久化——刷新后还留着上次的筛选和选中项不符合直觉，
 * 用户会以为库里的游戏丢了。需要跨会话记住的（布局、排序）在 settingsStore 里。
 */
import { create } from 'zustand'

import type { LibraryFilter } from '@/types/ui'
import { EMPTY_FILTER } from '@/types/ui'

export interface LibraryState {
  filter: LibraryFilter
  /** 多选批量操作的选中项。用数组而非 Set，selector 比较和序列化都更省心 */
  selection: string[]

  /** 局部更新筛选条件，未传的字段保持不变 */
  setFilter: (patch: Partial<LibraryFilter>) => void
  resetFilter: () => void
  /** 只改关键词的快捷方式，搜索框用 */
  setKeyword: (keyword: string) => void

  toggleSelect: (id: string) => void
  /** 整体替换选中集合（全选 / 反选用） */
  setSelection: (ids: readonly string[]) => void
  clearSelection: () => void
}

export const useLibraryStore = create<LibraryState>()((set) => ({
  filter: EMPTY_FILTER,
  selection: [],

  setFilter: (patch) => {
    set((state) => ({ filter: { ...state.filter, ...patch } }))
  },

  resetFilter: () => {
    set((state) => (state.filter === EMPTY_FILTER ? state : { filter: EMPTY_FILTER }))
  },

  setKeyword: (keyword) => {
    set((state) =>
      state.filter.keyword === keyword ? state : { filter: { ...state.filter, keyword } },
    )
  },

  toggleSelect: (id) => {
    set((state) => ({
      selection: state.selection.includes(id)
        ? state.selection.filter((item) => item !== id)
        : [...state.selection, id],
    }))
  },

  setSelection: (ids) => {
    set({ selection: [...ids] })
  },

  clearSelection: () => {
    set((state) => (state.selection.length === 0 ? state : { selection: [] }))
  },
}))

/** 是否存在生效中的筛选条件。用于决定要不要显示「最近游玩」横排。 */
export function hasActiveFilter(filter: LibraryFilter): boolean {
  return (
    filter.keyword.trim().length > 0 ||
    filter.categories.length > 0 ||
    filter.yearRange !== null ||
    filter.favoriteOnly
  )
}
