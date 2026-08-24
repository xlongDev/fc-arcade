import { useCallback, useEffect, useState } from 'react'

import { ProductTour } from '@/components/ui/ProductTour'
import type { TourStep } from '@/components/ui/ProductTour'
import {
  IconCartridge,
  IconGamepad,
  IconPalette,
  IconSearch,
  IconSettings,
  IconUpload,
} from '@/components/icons'

const TOUR_STORAGE_KEY = 'fc-arcade:library-tour-completed'

const TOUR_STEPS: TourStep[] = [
  {
    title: '欢迎来到 FC Arcade',
    description: '这是一个在浏览器里运行的红白机游戏库。所有 ROM 都只保存在本地，离线也能玩。下面用 30 秒带你熟悉界面。',
    icon: <IconCartridge size={22} />,
  },
  {
    target: '#library-import-btn',
    title: '从这里导入 ROM',
    description: '点击大红色的「导入 ROM 文件」按钮，选择你合法拥有的 .nes 文件即可加入游戏库。',
    icon: <IconUpload size={22} />,
  },
  {
    target: '#topnav-import-btn',
    title: '随时都能导入',
    description: '页面顶部导航栏也常驻导入按钮，逛库时拖入文件或点击这里都能快速添加新游戏。',
    icon: <IconUpload size={22} />,
  },
  {
    target: '#library-search-field',
    title: '搜索与筛选',
    description: '游戏多了之后，用搜索框快速定位，还可以按年份、类型、收藏状态筛选。',
    icon: <IconSearch size={22} />,
  },
  {
    target: '#theme-toggle-btn',
    title: '切换明暗与主题',
    description: '点太阳/月亮切换深浅模式，旁边的调色盘按钮能快速切换 30+ 套像素风主题。',
    icon: <IconPalette size={22} />,
  },
  {
    target: '#settings-nav-link',
    title: '更多设置',
    description: '按键映射、手柄配置、画面滤镜、自动存档等高级选项都在设置页里。',
    icon: <IconSettings size={22} />,
  },
  {
    title: '开始你的像素时光',
    description: '现在就去导入第一个 ROM 吧。如果遇到问题，随时从设置页或底部链接反馈。',
    icon: <IconGamepad size={22} />,
  },
]

function hasCompletedTour(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'done'
  } catch {
    return false
  }
}

interface LibraryTourProps {
  /** 受控打开；不传则由组件自己根据 autoRun 与 localStorage 决定 */
  open?: boolean
  /** 打开状态变化回调 */
  onOpenChange?: (open: boolean) => void
  /** 是否在挂载后自动触发（仅首次访问） */
  autoRun?: boolean
}

/**
 * 游戏库空状态时的产品引导。
 *
 * - 首次进入空库自动弹出；
 * - 完成后写入 localStorage，不再自动打扰；
 * - 用户仍可通过 LibraryEmpty 的「查看引导」手动重看。
 */
export function LibraryTour({ open: controlledOpen, onOpenChange, autoRun = false }: LibraryTourProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  useEffect(() => {
    if (isControlled || !autoRun || hasCompletedTour()) return
    // 等页面首屏稳定后再弹出，避免目标元素还没渲染完导致定位不准
    const timer = window.setTimeout(() => setOpen(true), 600)
    return () => window.clearTimeout(timer)
  }, [isControlled, autoRun, setOpen])

  return (
    <ProductTour
      open={open}
      steps={TOUR_STEPS}
      storageKey={TOUR_STORAGE_KEY}
      onClose={() => setOpen(false)}
      onComplete={() => setOpen(false)}
    />
  )
}

export { TOUR_STORAGE_KEY }
