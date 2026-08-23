import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * 系统级「减少动效」偏好。
 *
 * 组件库刻意只读系统偏好、不读 @/store —— ui/ 是最底层的一层，
 * 反向依赖业务 store 会让它没法被独立测试，也会在启动顺序上打结。
 * 需要把「设置页里的开关」也算进来的地方，用 features 层的 useReduceMotion。
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    // 与媒体查询外部系统同步：挂载时立即同步初始值，属于 effect 与外部系统同步。
    // eslint-disable-next-line react/set-state-in-effect
    setReduced(mql.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return reduced
}
