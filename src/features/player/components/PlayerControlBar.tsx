import type { ReactNode } from 'react'
import { motion } from 'motion/react'

import { IconButton, Popover, Slider } from '@/components/ui'
import {
  IconCamera,
  IconFullscreen,
  IconFullscreenExit,
  IconGamepad,
  IconKeyboard,
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
  fullscreen: boolean
  fullscreenSupported: boolean
  reduceMotion: boolean
  /** 桌面端就地展开的存读档面板；传 null 表示交给外层 Sheet 处理 */
  savePanel: ReactNode
  savesOpen: boolean
  onSavesOpenChange: (open: boolean) => void
  onTogglePause: () => void
  onReset: () => void
  onToggleMute: () => void
  onVolumeChange: (value: number) => void
  onScreenshot: () => void
  onToggleTouch: () => void
  onOpenSaves: () => void
  onOpenKeyboard: () => void
  onToggleFullscreen: () => void
}

/** 组内分隔线：极淡的竖线，让功能分区一眼可辨 */
const GroupDivider = () => <span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />

/**
 * 底部控制栏。
 * 三段式浮岛：左（重置 / 存读档）、中（暂停主控）、右（截图 / 键位 / 音量 / 全屏 / 虚拟手柄）。
 * 暂停按钮刻意降权成 ghost，不再用高饱和实心红抢画面注意力；
 * 音量折叠进 Popover，桌面移动端统一为「图标 → 上弹短滑块」。
 */
export function PlayerControlBar({
  running,
  muted,
  volume,
  touchVisible,
  showTouchToggle,
  fullscreen,
  fullscreenSupported,
  reduceMotion,
  savePanel,
  savesOpen,
  onSavesOpenChange,
  onTogglePause,
  onReset,
  onToggleMute,
  onVolumeChange,
  onScreenshot,
  onToggleTouch,
  onOpenSaves,
  onOpenKeyboard,
  onToggleFullscreen,
}: Props) {
  const saveTrigger = (
    <IconButton label="存档 / 读档" variant="ghost" onClick={onOpenSaves}>
      <IconSave size={18} />
    </IconButton>
  )

  const volumeTrigger = (
    <IconButton label="音量" variant="ghost" active={muted}>
      {muted ? <IconMute size={18} /> : <IconVolume size={18} />}
    </IconButton>
  )

  const fullscreenButton = fullscreenSupported ? (
    <IconButton
      label={fullscreen ? '退出全屏' : '全屏'}
      variant="ghost"
      onClick={onToggleFullscreen}
    >
      {fullscreen ? <IconFullscreenExit size={18} /> : <IconFullscreen size={18} />}
    </IconButton>
  ) : null

  return (
    <motion.div
      initial={reduceMotion ? false : { y: 28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: 28, opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : SPRING}
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10"
    >
      <div className="glass flex items-center gap-1 rounded-full px-2 py-1.5">
        {/* 左：系统操作 */}
        <div className="flex items-center gap-1">
          <IconButton label="重置游戏" variant="ghost" onClick={onReset}>
            <IconRefresh size={18} />
          </IconButton>
          {savePanel === null ? (
            saveTrigger
          ) : (
            <Popover
              trigger={saveTrigger}
              side="top"
              align="center"
              centerOnViewport
              open={savesOpen}
              onOpenChange={onSavesOpenChange}
            >
              {savePanel}
            </Popover>
          )}
        </div>

        <GroupDivider />

        {/* 中：主控（暂停 / 继续），降权但作为视觉重心略大 */}
        <div className="flex items-center gap-1">
          <IconButton
            label={running ? '暂停' : '继续'}
            variant="ghost"
            size="lg"
            onClick={onTogglePause}
          >
            {running ? <IconPause size={20} /> : <IconPlay size={20} />}
          </IconButton>
        </div>

        <GroupDivider />

        {/* 右：媒体与系统 */}
        <div className="flex items-center gap-1">
          <IconButton label="截图" variant="ghost" onClick={onScreenshot}>
            <IconCamera size={18} />
          </IconButton>
          <IconButton label="键位设置" variant="ghost" onClick={onOpenKeyboard}>
            <IconKeyboard size={18} />
          </IconButton>
          <Popover trigger={volumeTrigger} side="top" align="center" className="p-2.5">
            <div className="flex w-44 items-center gap-3">
              <IconButton
                label={muted ? '取消静音' : '静音'}
                variant="ghost"
                size="sm"
                active={muted}
                onClick={onToggleMute}
              >
                {muted ? <IconMute size={16} /> : <IconVolume size={16} />}
              </IconButton>
              <div className="flex-1">
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
          </Popover>
          {fullscreenButton}
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
      </div>
    </motion.div>
  )
}
