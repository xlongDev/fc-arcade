import type { GameView } from '@/types/game'

/** 卡片上的操作集合。各种布局共用同一套回调，避免每个视图重复声明一堆 props。 */
export interface GameActions {
  onPlay: (game: GameView) => void
  onDetail: (game: GameView) => void
  onDelete: (game: GameView) => void
  onToggleFavorite: (game: GameView) => void
  onToggleSelect: (game: GameView) => void
}

export interface GameItemProps {
  game: GameView
  actions: GameActions
  /** 是否启用 layout / 倾斜等重动画。虚拟化开启时统一关掉。 */
  animate: boolean
  selected: boolean
  selectionMode: boolean
}
