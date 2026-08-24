import type { ReactNode } from 'react'
import { m } from 'motion/react'
import { Link } from 'react-router'

import { IconChevronUp, IconGamepad, IconGitHub } from '@/components/icons'
import { useReduceMotion } from '@/features/common/hooks/useReduceMotion'

const REPO_URL = 'https://github.com/xlongDev/fc-arcade'
const ISSUES_URL = 'https://github.com/xlongDev/fc-arcade/issues'

/** 入场：默认从下方淡入上浮，削减动效时退化为瞬时淡入 */
const footerVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
} as const

const footerVariantsReduced = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.001 } },
} as const

type FooterLinkProps = {
  children: ReactNode
  /** 站内路由，用 <Link> 渲染 */
  to?: string
  /** 外链地址，用 <a> 渲染并加 target/rel */
  href?: string
}

/** 普通文本链接：套用 footer-link，hover/focus 触发下划线动效 */
function FooterNavLink({ children, to, href }: FooterLinkProps) {
  if (to) {
    return (
      <Link to={to} className="footer-link text-sm">
        {children}
      </Link>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="footer-link text-sm"
    >
      {children}
    </a>
  )
}

/**
 * 全站页脚：品牌区 + 两栏导航 + 底栏（版权 / 回到顶部）。
 * 像素家风、颜色走 token，入场动效尊重 reduce-motion。
 * 挂在 RootLayout，沉浸式 /play/ 页面不渲染。
 */
export function Footer() {
  const reduceMotion = useReduceMotion()
  const variants = reduceMotion ? footerVariantsReduced : footerVariants

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <m.footer
      initial="hidden"
      animate="show"
      variants={variants}
      className="border-t border-[var(--color-border)] bg-[var(--color-bg-alt)]"
    >
      {/* 移动端底部留出固定 TabBar 的安全区，避免页脚被遮挡 */}
      <div className="mx-auto w-full max-w-[1600px] px-3 pb-28 pt-12 sm:px-5 md:pb-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          {/* 品牌区 */}
          <div className="flex flex-col gap-4">
            <Link
              to="/"
              className="group inline-flex w-fit items-center gap-2 rounded-md focus-ring"
              aria-label="FC Arcade 首页"
            >
              <span className="grid size-9 place-items-center rounded-lg border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] transition-transform duration-200 ease-snap group-hover:scale-105">
                <IconGamepad size={18} />
              </span>
              <span className="font-pixel-cn text-base font-semibold tracking-wide text-[var(--color-text)]">
                FC ARCADE
              </span>
            </Link>

            <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
              在浏览器里重温红白机的像素时光。基于 fceumm 核心，离线也能畅玩经典 ROM。
            </p>

            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="在 GitHub 上查看源码"
              className="footer-link w-fit text-sm"
            >
              <IconGitHub size={16} />
              <span>在 GitHub 上星标</span>
            </a>
          </div>

          {/* 探索 */}
          <nav className="flex flex-col gap-3" aria-label="页脚导航">
            <h2 className="font-pixel-cn text-xs uppercase tracking-[0.18em] text-[var(--color-text-faint)]">
              探索
            </h2>
            <FooterNavLink to="/">游戏库</FooterNavLink>
            <FooterNavLink to="/settings">设置</FooterNavLink>
          </nav>

          {/* 资源 */}
          <nav className="flex flex-col gap-3" aria-label="页脚资源">
            <h2 className="font-pixel-cn text-xs uppercase tracking-[0.18em] text-[var(--color-text-faint)]">
              资源
            </h2>
            <FooterNavLink href={REPO_URL}>源码仓库</FooterNavLink>
            <FooterNavLink href={ISSUES_URL}>反馈问题</FooterNavLink>
          </nav>
        </div>

        {/* 底栏 */}
        <div className="mt-10 flex flex-col-reverse items-start justify-between gap-4 border-t border-[var(--color-border)] pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-[var(--color-text-faint)]">
            © {new Date().getFullYear()} FC Arcade · 用 fceumm 核心驱动
          </p>

          <button
            type="button"
            onClick={handleBackToTop}
            className="footer-link text-xs"
            aria-label="回到页面顶部"
          >
            <IconChevronUp size={14} />
            <span>回到顶部</span>
          </button>
        </div>
      </div>
    </m.footer>
  )
}
