import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'

/** 全屏。iOS Safari 的 iframe/元素全屏支持不全，失败时静默降级为普通沉浸布局。 */
export function useFullscreen(targetRef: RefObject<HTMLElement | null>): {
  active: boolean
  supported: boolean
  toggle: () => void
} {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(() => {
    const element = targetRef.current
    if (!element) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch((cause: unknown) => {
        console.warn('[fc-arcade] 退出全屏失败', cause)
      })
      return
    }
    void element.requestFullscreen({ navigationUI: 'hide' }).catch((cause: unknown) => {
      console.warn('[fc-arcade] 进入全屏失败', cause)
    })
  }, [targetRef])

  return {
    active,
    supported: typeof document !== 'undefined' && document.fullscreenEnabled,
    toggle,
  }
}
