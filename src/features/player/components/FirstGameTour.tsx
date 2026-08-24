import { useEffect, useState } from 'react'

import { ProductTour } from '@/components/ui/ProductTour'
import { IconGamepad, IconKeyboard } from '@/components/icons'

import type { TourStep } from '@/components/ui/ProductTour'

/** 首次运行游戏引导完成标记 */
export const FIRST_GAME_TOUR_KEY = 'fc-arcade:tour:first-game-played'

/** 是否已看过首次运行引导（隐私模式下按未看过处理，不影响使用） */
export function hasCompletedFirstGameTour(): boolean {
  try {
    return localStorage.getItem(FIRST_GAME_TOUR_KEY) === 'done'
  } catch {
    return false
  }
}

const STEPS: TourStep[] = [
  {
    title: '开始游戏吧！',
    description:
      '键盘操作：方向键移动，U / O 分别是 A / B 键，Enter 是 Start，Shift 是 Select。点画面任意位置即可获得焦点开始操作。',
    icon: <IconGamepad size={22} />,
  },
  {
    target: '#player-pause-btn',
    title: '底部控制栏',
    description:
      '这里可以暂停 / 继续游戏、重置、截图。暂停后还能存档读档，随时回到这一刻。',
    icon: <IconGamepad size={22} />,
  },
  {
    target: '#player-keyboard-btn',
    title: '自定义键位与设置',
    description:
      '点这个键位按钮可以改按键映射、调主题和画面滤镜。觉得默认键位不顺手，随时来这里改。',
    icon: <IconKeyboard size={22} />,
  },
]

interface FirstGameTourProps {
  /** 是否真的进游戏了（运行态、有内容），只有此时才值得弹出 */
  active: boolean
  /** 是否由外部控制打开（手动重看）；不传则首次自动弹出 */
  open?: boolean
  onClose?: () => void
}

/**
 * 首次运行游戏时的轻量引导（最多 3 步）。
 *
 * - 进入 Player 页且游戏真正开始运行、且从未看过时自动弹出；
 * - 看完/关闭后写入 localStorage，以后不再打扰；
 * - 若用户从「继续游玩」恢复，active 仍为 true，仍会弹出（首跑只认一次）。
 */
export function FirstGameTour({ active, open: controlledOpen, onClose }: FirstGameTourProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen

  const handleClose = () => {
    setInternalOpen(false)
    onClose?.()
  }

  useEffect(() => {
    if (isControlled || !active || hasCompletedFirstGameTour()) return
    // 等模拟器真正跑起来、控制栏挂载后再弹，避免定位不到目标
    const timer = window.setTimeout(() => setInternalOpen(true), 800)
    return () => window.clearTimeout(timer)
  }, [isControlled, active])

  return (
    <ProductTour
      open={open}
      steps={STEPS}
      storageKey={FIRST_GAME_TOUR_KEY}
      onClose={handleClose}
      onComplete={handleClose}
    />
  )
}
