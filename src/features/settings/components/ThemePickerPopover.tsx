import { useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { THEME_LIST, useTheme } from '@/theme'
import type { ThemeId } from '@/types/theme'
import { cn } from '@/lib/cn'

/**
 * 主题快速选择器 —— 从 TopNav 的调色板图标弹出。
 *
 * 设计要点：
 * - 4 列网格（24 套主题刚好 6 行），每张卡片有足够宽度显示完整中文名
 * - 色板条 + 完整名称，hover 时显示全名 tooltip 兜底
 * - 当前主题高亮（accent 边框 + 微光 + 角标指示器）
 * - hover 时卡片微上浮 + 阴影加深
 * - 切换时通过 setTheme(id, origin) 触发圆形揭示动画
 * - prefers-reduced-motion 下无动画
 */
export function ThemePickerContent({ onClose }: { onClose?: () => void }) {
  const { themeId, setTheme } = useTheme()

  const handleSelect = useCallback(
    (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
      setTheme(id as ThemeId, {
        x: event.clientX,
        y: event.clientY,
      })
      onClose?.()
    },
    [setTheme, onClose],
  )

  return (
    <div className="flex flex-col gap-2.5">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          主题
        </span>
        <span className="text-[10px] text-text-faint">{THEME_LIST.length} 套</span>
      </div>

      {/* 主题网格 — 4 列保证每张卡片足够宽放完整中文名 */}
      <div className="grid grid-cols-4 gap-1.5">
        {THEME_LIST.map((theme) => {
          const active = theme.id === themeId
          return (
            <button
              key={theme.id}
              type="button"
              onClick={(e) => handleSelect(theme.id, e)}
              title={theme.name}
              aria-label={`切换到 ${theme.name} 主题`}
              aria-pressed={active}
              className={cn(
                'group relative flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center',
                'transition-all duration-200 ease-snap',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-glass)]',
                active
                  ? 'border-accent bg-accent-soft/60 shadow-[0_0_14px_var(--color-accent)]/25'
                  : 'border-border bg-surface-alt/80 hover:border-accent-line/60 hover:bg-surface hover:shadow-md',
              )}
            >
              {/* 色板圆角条 */}
              <span className="flex h-6 w-full overflow-hidden rounded-lg ring-1 ring-black/8 dark:ring-white/8">
                {theme.swatch.map((color, i) => (
                  <span key={i} className="h-full flex-1" style={{ background: color }} />
                ))}
              </span>

              {/* 名称 — 不 truncate，让完整名字显示 */}
              <span
                className={cn(
                  'max-w-full text-[11px] leading-snug transition-colors duration-150',
                  active ? 'font-semibold text-accent' : 'text-text-muted group-hover:text-text',
                )}
              >
                {theme.name}
              </span>

              {/* 当前选中角标 */}
              <AnimatePresence>
                {active ? (
                  <motion.span
                    layoutId="theme-active-dot"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute -top-0.5 -right-0.5 flex size-2.5 items-center justify-center rounded-full bg-accent"
                    aria-hidden="true"
                  >
                    <span className="size-1 rounded-full bg-on-accent" />
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </button>
          )
        })}
      </div>
    </div>
  )
}
