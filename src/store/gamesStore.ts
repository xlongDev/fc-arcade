/**
 * 游戏列表缓存。
 *
 * IndexedDB 的读取集中在这里做一次，useGames / useFilteredGames 共用同一份结果——
 * 库页面同时用到这两个 hook，各自拉一遍会把 Dexie 的读放大一倍。
 * 写库的动作不在这里，写完由调用方 notifyLibraryChanged() 广播，页面再 refresh()。
 */
import { useEffect, useMemo } from 'react'
import { create } from 'zustand'

import { filterGames, gameDao, sortGames, toGameView } from '@/data'
import type { GameView } from '@/types/game'

import { useLibraryStore } from './libraryStore'
import { useSettingsStore } from './settingsStore'

export interface GamesState {
  views: GameView[]
  /** id → 写入时预计算的 searchText（含别名与拼音首字母），GameView 上没有这个字段 */
  searchTexts: Map<string, string>
  loading: boolean
  loaded: boolean
  error: string | null
  /** 首次加载；已经加载过就直接返回 */
  load: () => Promise<void>
  /** 强制重新拉取。引用稳定，可以直接当事件回调用。 */
  refresh: () => void
}

type SetGames = (partial: Partial<GamesState>) => void

/** 同一时刻只允许一次实际查询，多个组件同时挂载不会打穿数据库 */
let inflight: Promise<void> | null = null

async function fetchAll(set: SetGames): Promise<void> {
  set({ loading: true })
  try {
    const records = await gameDao.getAll()
    set({
      views: records.map(toGameView),
      searchTexts: new Map(records.map((r) => [r.id, r.searchText])),
      loading: false,
      loaded: true,
      error: null,
    })
  } catch (error) {
    console.error('[fc-arcade] 读取游戏库失败', error)
    set({
      loading: false,
      loaded: true,
      error: error instanceof Error ? error.message : '读取游戏库失败',
    })
  } finally {
    inflight = null
  }
}

function run(set: SetGames): Promise<void> {
  inflight ??= fetchAll(set)
  return inflight
}

export const useGamesStore = create<GamesState>()((set, get) => ({
  views: [],
  searchTexts: new Map(),
  // 初值为 true：挂载后必然会触发一次加载，先按加载中渲染，避免闪一下「库是空的」
  loading: true,
  loaded: false,
  error: null,

  load: () => (get().loaded ? Promise.resolve() : run(set)),

  refresh: () => {
    void run(set)
  },
}))

export interface UseGamesResult {
  games: GameView[]
  loading: boolean
  error: string | null
  refresh: () => void
}

/** 库内全部游戏（未过滤）。首次调用会触发加载。 */
export function useGames(): UseGamesResult {
  const games = useGamesStore((s) => s.views)
  const loading = useGamesStore((s) => s.loading)
  const error = useGamesStore((s) => s.error)
  const refresh = useGamesStore((s) => s.refresh)

  useEffect(() => {
    void useGamesStore.getState().load()
  }, [])

  return { games, loading, error, refresh }
}

export interface UseFilteredGamesResult {
  games: GameView[]
  loading: boolean
}

/**
 * 应用当前筛选（libraryStore）与排序（settingsStore）后的列表。
 * 过滤排序复用 @/data 里的实现，和 DAO 的 list() 行为完全一致。
 */
export function useFilteredGames(): UseFilteredGamesResult {
  const views = useGamesStore((s) => s.views)
  const searchTexts = useGamesStore((s) => s.searchTexts)
  const loading = useGamesStore((s) => s.loading)
  const filter = useLibraryStore((s) => s.filter)
  const sortBy = useSettingsStore((s) => s.settings.sortBy)
  const sortDir = useSettingsStore((s) => s.settings.sortDir)

  useEffect(() => {
    void useGamesStore.getState().load()
  }, [])

  const games = useMemo(() => {
    const filtered = filterGames(views, filter, (view) => searchTexts.get(view.id) ?? '')
    return sortGames(filtered, sortBy, sortDir)
  }, [views, searchTexts, filter, sortBy, sortDir])

  return { games, loading }
}

/** 按 id 取单个游戏视图。详情弹窗、播放器页用。 */
export function useGame(id: string | null): GameView | null {
  const views = useGamesStore((s) => s.views)
  return useMemo(() => (id ? (views.find((v) => v.id === id) ?? null) : null), [views, id])
}
