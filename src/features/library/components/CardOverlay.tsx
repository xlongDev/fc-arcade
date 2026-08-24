import type { MouseEvent } from 'react'

import { IconButton } from '@/components/ui'
import { IconEdit, IconExport, IconPlay, IconTrash } from '@/components/icons'
import type { GameView } from '@/types/game'

import type { GameActions } from '../types'

interface Props {
  game: GameView
  actions: GameActions
  compact?: boolean
}

/**
 * 悬停浮出的操作层。
 * 用纯 CSS 过渡而不是 motion——列表里可能有几百张卡，每张再挂一个动画实例不划算。
 */

/** 阻止事件冒泡后再执行回调（纯函数，不依赖组件作用域） */
function stopPropagation(event: MouseEvent, run: () => void): void {
  event.stopPropagation()
  run()
}

export function CardOverlay({ game, actions, compact = false }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[var(--color-bg)]/85 opacity-0 transition-opacity duration-200 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={(event) => stopPropagation(event, () => actions.onPlay(game))}
        className="flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-[var(--color-on-accent)] transition-transform hover:scale-105 active:scale-95"
      >
        <IconPlay size={14} />
        开始游戏
      </button>

      {compact ? null : (
        <div className="flex items-center gap-2">
          <IconButton
            label="编辑游戏信息"
            size="sm"
            variant="glass"
            onClick={(event: MouseEvent) => stopPropagation(event, () => actions.onDetail(game))}
          >
            <IconEdit size={14} />
          </IconButton>
          <IconButton
            label="导出该游戏存档"
            size="sm"
            variant="glass"
            onClick={(event: MouseEvent) => stopPropagation(event, () => actions.onExportSaves(game))}
          >
            <IconExport size={14} />
          </IconButton>
          <IconButton
            label="删除游戏"
            size="sm"
            variant="glass"
            onClick={(event: MouseEvent) => stopPropagation(event, () => actions.onDelete(game))}
          >
            <IconTrash size={14} />
          </IconButton>
        </div>
      )}
    </div>
  )
}
