import { useEffect, useState } from 'react'

const IDLE_MS = 2000

/**
 * 游戏运行时自动隐藏鼠标光标。
 *
 * 只在 enabled 为 true 时生效：运行中、控制栏已隐藏、没有弹层面板。
 * 鼠标静止超过 IDLE_MS 后返回 true，调用方把它映射成 cursor-none 即可；
 * 一旦移动、enabled 变 false 或组件卸载就恢复光标。
 */
export function useHideCursor(enabled: boolean): boolean {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setHidden(false)
      return
    }

    let timer = 0
    const show = () => {
      setHidden(false)
      window.clearTimeout(timer)
    }
    const scheduleHide = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setHidden(true), IDLE_MS)
    }

    show()
    scheduleHide()

    const onActivity = () => {
      show()
      scheduleHide()
    }

    window.addEventListener('pointermove', onActivity, { passive: true })
    window.addEventListener('pointerdown', onActivity, { passive: true })
    window.addEventListener('keydown', onActivity)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', onActivity)
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
    }
  }, [enabled])

  return hidden
}
