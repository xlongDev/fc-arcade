import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/** 观察元素宽度。虚拟化网格必须知道实际可用宽度才能算出列数。 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    setWidth(el.clientWidth)

    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => setWidth(el.clientWidth)
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return width
}
