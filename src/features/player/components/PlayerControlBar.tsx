import type { ReactNode } from 'react'
import { motion } from 'motion/react'

import { IconButton, Popover, Slider } from '@/components/ui'
import {
  IconCamera,
  IconGamepad,
  IconMute,
  IconPause,
  IconPlay,
  IconRefresh,
  IconSave,
  IconVolume,
} from '@/components/icons'
import { SPRING } from '@/features/common/motion'

interface Props {
  running: boolean
  muted: boolean
  volume: number
  touchVisible: boolean
  showTouchToggle: boolean
  reduceMotion: boolean
  /** 桌面端就地展开的存读档面板；传 null 表示交给外层 Sheet 处理 */
  savePanel: ReactNode
  onTogglePause: () => void
  onReset: () => void
  onToggleMute: () => void
  onVolumeChange: (value: number) => void
  onScreenshot: () => void
  onToggleTouch: () => void
  onOpenSaves: () => void
}

/**
 * 底部控制栏。
 * 桌面把存读档塞进 Popover 就地展开，移动端交给外层用 Sheet 打开（onOpenSaves）。
 */
export function PlayerControlBar({
  running,
  muted,
  volume,
  touchVisible,
  showTouchToggle,
  reduceMotion,
  savePanel,
  onTogglePause,
  onReset,
  onToggleMute,
  onVolumeChange,
  onScreenshot,
  onToggleTouch,
  onOpenSaves,
}: Props) {
  const saveButton = (
    <IconButton label="存档 / 读档" variant="ghost" onClick={onOpenSaves}>
      <IconSave size={18} />
    </IconButton>
  )

  return (
    <motion.div
      initial={reduceMotion ? false : { y: 28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: 28, opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : SPRING}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10"
    >
      <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 py-1.5 backdrop-blur-xl">
        <IconButton
          label={running ? '暂停' : '继续'}
          variant="solid"
          onClick={onTogglePause}
        >
          {running ? <IconPause size={18} /> : <IconPlay size={18} />}
        </IconButton>

        <IconButton label="重置游戏" variant="ghost" onClick={onReset}>
          <IconRefresh size={18} />
        </IconButton>

        {savePanel === null ? (
          saveButton
        ) : (
          <Popover trigger={saveButton} side="top" align="center">
            {savePanel}
          </Popover>
        )}

        <IconButton label="截图" variant="ghost" onClick={onScreenshot}>
          <IconCamera size={18} />
        </IconButton>

        <div className="mx-1 hidden items-center gap-2 sm:flex">
          <IconButton
            label={muted ? '取消静音' : '静音'}
            variant="ghost"
            active={muted}
            onClick={onToggleMute}
          >
            {muted ? <IconMute size={18} /> : <IconVolume size={18} />}
          </IconButton>
          <div className="w-24">
            <Slider
              value={muted ? 0 : volume}
              onChange={onVolumeChange}
              min={0}
              max={1}
              step={0.05}
              label="音量"
              formatValue={(value: number) => `${Math.round(value * 100)}%`}
            />
          </div>
        </div>

        <div className="sm:hidden">
          <IconButton
            label={muted ? '取消静音' : '静音'}
            variant="ghost"
            active={muted}
            onClick={onToggleMute}
          >
            {muted ? <IconMute size={18} /> : <IconVolume size={18} />}
          </IconButton>
        </div>

        {showTouchToggle ? (
          <IconButton
            label={touchVisible ? '隐藏虚拟手柄' : '显示虚拟手柄'}
            variant="ghost"
            active={touchVisible}
            onClick={onToggleTouch}
          >
            <IconGamepad size={18} />
          </IconButton>
        ) : null}
      </div>
    </motion.div>
  )
}
