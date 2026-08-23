import { useEffect, useState } from 'react'

const IDLE_MS = 5000

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
      // 与 enabled 外部条件同步：不启用时立即恢复光标，属于 effect 与交互状态同步。
      // eslint-disable-next-line react/set-state-in-effect
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

    // 注意：不要监听 keydown。游戏键盘输入（方向键 / A / B）属于手柄操作，
    // 不应重新显示光标；只有鼠标活动（移动 / 点击）才让光标出现。
    const onActivity = () => {
      show()
      scheduleHide()
    }

    window.addEventListener('pointermove', onActivity, { passive: true })
    window.addEventListener('pointerdown', onActivity, { passive: true })

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', onActivity)
      window.removeEventListener('pointerdown', onActivity)
    }
  }, [enabled])

  return hidden
}
