import { motion } from 'motion/react'

import { Badge, IconButton } from '@/components/ui'
import { IconArrowLeft, IconFullscreen, IconFullscreenExit, IconRefresh } from '@/components/icons'
import { SPRING } from '@/features/common/motion'
import type { GameView } from '@/types/game'
import type { EmulatorCore } from '@/types/emulator'
import { CORE_DISPLAY_NAME } from '@/types/emulator'
import { displaySubtitle, displayTitle } from '@/features/common/lib/gameDisplay'

interface Props {
  game: GameView
  fps: number
  showFps: boolean
  core: EmulatorCore
  fullscreen: boolean
  fullscreenSupported: boolean
  reduceMotion: boolean
  switchingCore?: boolean
  onExit: () => void
  onToggleFullscreen: () => void
  onSwitchCore: () => void
}

/** 播放器顶栏。沉浸模式下随控制栏一起淡出。 */
export function PlayerTopBar({
  game,
  fps,
  showFps,
  core,
  fullscreen,
  fullscreenSupported,
  reduceMotion,
  switchingCore,
  onExit,
  onToggleFullscreen,
  onSwitchCore,
}: Props) {
  const subtitle = displaySubtitle(game)

  return (
    <motion.header
      initial={reduceMotion ? false : { y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: -24, opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : SPRING}
      className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5"
    >
      <IconButton label="返回游戏库" variant="ghost" onClick={onExit}>
        <IconArrowLeft size={18} />
      </IconButton>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{displayTitle(game)}</p>
        {subtitle ? <p className="truncate text-xs text-white/55">{subtitle}</p> : null}
      </div>

      {showFps ? (
        <Badge variant="default" size="sm">
          {fps.toFixed(0)} FPS
        </Badge>
      ) : null}
      <Badge variant="default" size="sm">
        {CORE_DISPLAY_NAME[core]}
      </Badge>
      <IconButton
        label="切换内核"
        variant="ghost"
        size="sm"
        disabled={switchingCore}
        onClick={onSwitchCore}
        className="text-white/80 hover:bg-white/10 hover:text-white"
      >
        <IconRefresh size={16} />
      </IconButton>

      {fullscreenSupported ? (
        <IconButton
          label={fullscreen ? '退出全屏' : '全屏'}
          variant="ghost"
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <IconFullscreenExit size={18} /> : <IconFullscreen size={18} />}
        </IconButton>
      ) : null}
    </motion.header>
  )
}
