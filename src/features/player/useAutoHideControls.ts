import { useCallback, useEffect, useRef, useState } from 'react'

const IDLE_MS = 2000

/**
 * 控制栏自动淡出。
 * 暂停、出错、面板展开时强制常显——那些时候用户正需要点按钮，藏起来只会添乱。
 */
export function useAutoHideControls(keepVisible: boolean): {
  visible: boolean
  ping: () => void
} {
  const [visible, setVisible] = useState(true)
  const timerRef = useRef(0)

  const ping = useCallback(() => {
    setVisible(true)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setVisible(false), IDLE_MS)
  }, [])

  useEffect(() => {
    if (keepVisible) {
      window.clearTimeout(timerRef.current)
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
