import { m } from 'motion/react'

import { IconButton } from '@/components/ui'
import { IconArrowLeft } from '@/components/icons'
import { SPRING } from '@/features/common/motion'
import type { GameView } from '@/types/game'
import type { EmulatorCore } from '@/types/emulator'
import { CORE_DISPLAY_NAME } from '@/types/emulator'
import { displaySubtitle, displayTitle } from '@/features/common/lib/gameDisplay'

import { PlayerStatusPill } from './PlayerStatusPill'

interface Props {
  game: GameView
  fps: number
  showFps: boolean
  core: EmulatorCore
  reduceMotion: boolean
  onExit: () => void
}

/** 播放器顶栏。沉浸模式下随控制栏一起淡出。 */
export function PlayerTopBar({ game, fps, showFps, core, reduceMotion, onExit }: Props) {
  const subtitle = displaySubtitle(game)

  return (
    <m.header
      initial={reduceMotion ? false : { y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: -24, opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : SPRING}
      className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-gradient-to-b from-surface/60 to-transparent px-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5"
    >
      <IconButton label="返回游戏库" variant="ghost" onClick={onExit}>
        <IconArrowLeft size={18} />
      </IconButton>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{displayTitle(game)}</p>
        {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
      </div>

      <PlayerStatusPill fps={fps} showFps={showFps} coreName={CORE_DISPLAY_NAME[core]} />
    </m.header>
  )
}
