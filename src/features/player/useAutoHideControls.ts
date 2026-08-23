import { useCallback, useEffect, useRef, useState } from 'react'

const IDLE_MS = 5000

/**
 * 控制栏自动淡出（通用计时器，可分别用于顶部标题栏与底部功能栏）。
 *
 * 调用方通过 keepVisible 决定「何时强制常显」：
 * - 底部功能栏：暂停 / 出错 / 面板展开 / 虚拟手柄可见 时强制常显。
 * - 顶部标题栏：在底部那些条件之上，还要求「全屏」才允许淡出（非全屏始终保留）。
 *
 * 鼠标静止 IDLE_MS（5s）后淡出；一旦 pointermove / pointerdown 立刻恢复。
 */
export function useAutoHideControls(keepVisible: boolean): {
  visible: boolean
  ping: () => void
} {
  const [visible, setVisible] = useState(true)
  const timerRef = useRef(0)

  const ping = useCallback(() => {
    // keepVisible=true 时面板本来就该常显，启动 hide timer 反而违反意图。
    // deps 依赖 keepVisible，所以 keepVisible 翻转时 ping 会重建；
    // 在 shell 的 onPointerMove 等 React 事件路径里，这个判断会拦住所有冗余 timer。
    setVisible(true)
    window.clearTimeout(timerRef.current)
    if (!keepVisible) {
      timerRef.current = window.setTimeout(() => setVisible(false), IDLE_MS)
    }
  }, [keepVisible])

  useEffect(() => {
    if (keepVisible) {
      window.clearTimeout(timerRef.current)
      // 与 keepVisible 外部条件同步：强制常显时立即恢复可见，属于 effect 与交互状态同步。
      // eslint-disable-next-line react/set-state-in-effect
      setVisible(true)
      return
    }
    ping()
    // 注意：不要监听 keydown。游戏键盘输入（方向键 / A / B）属于手柄操作，
    // 不应唤醒控制栏；只有鼠标活动（移动 / 点击）才让栏出现。
    const onActivity = () => ping()
    window.addEventListener('pointermove', onActivity, { passive: true })
    window.addEventListener('pointerdown', onActivity, { passive: true })
    return () => {
      window.clearTimeout(timerRef.current)
      window.removeEventListener('pointermove', onActivity)
      window.removeEventListener('pointerdown', onActivity)
    }
  }, [keepVisible, ping])

  return { visible, ping }
}
