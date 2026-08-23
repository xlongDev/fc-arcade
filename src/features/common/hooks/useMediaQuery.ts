import { useEffect, useState } from 'react'

function readMatch(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

/** 订阅一条媒体查询。SSR / 不支持 matchMedia 时返回 false。 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => readMatch(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    // 与媒体查询外部系统同步：query 变化时立即同步初始值，属于 effect 与外部系统同步。
    // eslint-disable-next-line react/set-state-in-effect
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** 小于 Tailwind md 断点视为移动端 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}

/** 小于 Tailwind lg 断点：平板及以下，筛选面板要走 Sheet */
export function useIsCompactViewport(): boolean {
  return useMediaQuery('(max-width: 1023px)')
}

/** 主输入方式为粗指针（手指），用来决定是否渲染虚拟手柄 */
export function useIsTouchDevice(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)')
}

/** 竖屏 */
export function useIsPortrait(): boolean {
  return useMediaQuery('(orientation: portrait)')
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
