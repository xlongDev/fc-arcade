import type { LibraryLayout } from '@/types/ui'

/**
 * 超过这个数量就切到虚拟化渲染。
 * 60 是实测的分界：再多的话，每张卡带一个 motion layout 实例会让筛选重排明显掉帧。
 */
export const VIRTUALIZE_THRESHOLD = 60

export interface GridLayoutConfig {
  /** 单列最小宽度，用来推算列数 */
  minItemWidth: number
  gap: number
  /** 封面宽高比（宽 / 高） */
  coverAspect: number
  /** 封面之外的文字区域高度 */
  metaHeight: number
}

export const GRID_CONFIG: Readonly<Record<'grid' | 'compact' | 'wall', GridLayoutConfig>> = {
  grid: { minItemWidth: 210, gap: 16, coverAspect: 4 / 3, metaHeight: 100 },
  compact: { minItemWidth: 136, gap: 10, coverAspect: 4 / 3, metaHeight: 40 },
  wall: { minItemWidth: 150, gap: 0, coverAspect: 4 / 3, metaHeight: 0 },
}

/** 列表行高，固定值让虚拟化不需要测量 */
export const LIST_ROW_HEIGHT = 88
export const LIST_ROW_GAP = 8

/** 卡带架单张卡片宽度 */
export const SHELF_ITEM_WIDTH = 176
export const SHELF_GAP = 14

export function isGridLayout(layout: LibraryLayout): layout is 'grid' | 'compact' | 'wall' {
  return layout === 'grid' || layout === 'compact' || layout === 'wall'
}

export function computeColumns(width: number, config: GridLayoutConfig): number {
  if (width <= 0) return 1
  const { minItemWidth, gap } = config
  return Math.max(1, Math.floor((width + gap) / (minItemWidth + gap)))
}
