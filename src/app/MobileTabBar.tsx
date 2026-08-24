import { NavLink } from 'react-router'
import { m } from 'motion/react'

import { IconHome, IconSettings, IconUpload } from '@/components/icons'
import { useImport } from '@/features/import/ImportContext'
import { SPRING_SOFT } from '@/features/common/motion'
import { cn } from '@/lib/cn'

/** 移动端底部导航。桌面端 md 以上隐藏。 */
export function MobileTabBar() {
  const { open } = useImport()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pt-0 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around gap-1 rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] px-2 py-1.5 backdrop-blur-[var(--glass-blur)] sm:py-2">
        <TabLink to="/" end label="游戏库" icon={<IconHome size={16} className="sm:size-[18px]" />} />

        <button
          type="button"
          onClick={() => open()}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1 text-[var(--color-text-muted)] transition-transform active:scale-95 sm:gap-1 sm:py-1.5"
        >
          <span className="flex size-8 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-[var(--color-on-accent)] sm:size-9">
            <IconUpload size={16} className="sm:size-[17px]" />
          </span>
          <span className="text-[10px]">导入</span>
        </button>

        <TabLink to="/settings" label="设置" icon={<IconSettings size={16} className="sm:size-[18px]" />} />
      </div>
    </nav>
  )
}

interface TabLinkProps {
  to: string
  label: string
  icon: React.ReactNode
  end?: boolean
}

function TabLink({ to, label, icon, end = false }: TabLinkProps) {
  return (
    <NavLink to={to} end={end} className="relative flex-1">
      {({ isActive }) => (
        <span className="relative flex flex-col items-center gap-0.5 px-2 py-1 sm:gap-1 sm:py-1.5">
          {isActive ? (
            <m.span
              layoutId="tab-active-bg"
              transition={SPRING_SOFT}
              className="absolute inset-0 rounded-2xl bg-[var(--color-surface-alt)]"
            />
          ) : null}
          <span
            className={cn(
              'relative flex size-8 items-center justify-center sm:size-9',
              isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]',
            )}
          >
            {icon}
          </span>
          <span
            className={cn(
              'relative text-[10px]',
              isActive ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]',
            )}
          >
            {label}
          </span>
        </span>
      )}
    </NavLink>
  )
}
