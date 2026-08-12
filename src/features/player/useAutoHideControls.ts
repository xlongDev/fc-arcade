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
    const onActivity = () => ping()
    window.addEventListener('pointermove', onActivity, { passive: true })
    window.addEventListener('pointerdown', onActivity, { passive: true })
    window.addEventListener('keydown', onActivity)
    return () => {
      window.clearTimeout(timerRef.current)
      window.removeEventListener('pointermove', onActivity)
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
    }
  }, [keepVisible, ping])

  return { visible, ping }
}
