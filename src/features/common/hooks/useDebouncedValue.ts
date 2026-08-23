import { useEffect, useState } from 'react'

/** 值防抖。输入框即时过滤用，默认 300ms。 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    if (delayMs <= 0) {
      // 与 value 外部输入同步：无延迟时立即同步，属于 effect 与外部状态同步。
      // eslint-disable-next-line react/set-state-in-effect
      setDebounced(value)
      return
    }
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
