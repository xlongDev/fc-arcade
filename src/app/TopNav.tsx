import { NavLink } from 'react-router'
import { motion } from 'motion/react'

import { Button, IconButton, Tooltip } from '@/components/ui'
import { IconGamepad, IconGitHub, IconMoon, IconSettings, IconSun, IconUpload } from '@/components/icons'
import { useImport } from '@/features/import/ImportContext'
import { LibrarySearchField } from '@/features/library/components/LibrarySearchField'
import { SPRING_SOFT } from '@/features/common/motion'
import { useTheme } from '@/theme'
import { cn } from '@/lib/cn'

import { StorageMeter } from './StorageMeter'

const NAV_ITEMS = [
  { to: '/', label: '游戏库', end: true },
  { to: '/settings', label: '设置', end: false },
] as const

interface Props {
  /** 只有游戏库页面才在导航栏里放搜索框 */
  showSearch: boolean
}

export function TopNav({ showSearch }: Props) {
  const { mode, toggleMode } = useTheme()
  const { open } = useImport()

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav className="mx-auto flex max-w-[1600px] items-center gap-3 rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] px-3 py-2.5 backdrop-blur-[var(--glass-blur)] sm:gap-4 sm:px-5">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-[var(--color-on-accent)]">
            <IconGamepad size={19} />
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-pixel text-xs tracking-tight text-[var(--color-text)]">
              FC ARCADE
            </span>
            <span className="text-[10px] text-[var(--color-text-faint)]">红白机游戏合集</span>
          </span>
        </NavLink>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className="relative block px-3 py-1.5 text-sm">
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <motion.span
                        layoutId="nav-active-pill"
                        transition={SPRING_SOFT}
                        className="absolute inset-0 rounded-full bg-[var(--color-surface-alt)]"
                      />
                    ) : null}
                    <span
                      className={cn(
                        'relative',
                        isActive ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]',
                      )}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex min-w-0 flex-1 justify-end md:justify-center">
          {showSearch ? (
            <LibrarySearchField className="hidden w-full max-w-md md:block" />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StorageMeter className="hidden lg:flex" />

          <Button
            variant="primary"
            size="sm"
            icon={<IconUpload size={15} />}
            onClick={() => open()}
            className="hidden sm:inline-flex"
          >
            导入
          </Button>

          <Tooltip content={mode === 'dark' ? '切换到浅色' : '切换到深色'} side="bottom">
            <IconButton
              label={mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
              variant="glass"
              size="sm"
              onClick={(event: React.MouseEvent<HTMLButtonElement>) =>
                toggleMode({ x: event.clientX, y: event.clientY })
              }
            >
              {mode === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
            </IconButton>
          </Tooltip>

          <NavLink to="/settings" className="hidden md:block">
            <IconButton label="打开设置" variant="glass" size="sm">
              <IconSettings size={16} />
            </IconButton>
          </NavLink>

          <Tooltip content="在 GitHub 上查看源码" side="bottom">
            <a
              href="https://github.com/xlongDev/fc-arcade"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="在 GitHub 上查看源码"
              className="glass text-text hover:border-accent-line inline-flex size-9 shrink-0 items-center justify-center rounded-lg border transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-snap focus-ring active:scale-90"
            >
              <IconGitHub size={16} />
            </a>
          </Tooltip>
        </div>
      </nav>
    </header>
  )
}
