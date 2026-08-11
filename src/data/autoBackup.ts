/**
 * 自动备份守护。
 *
 * 触发方式两种，都受 `autoBackupEnabled` 总开关控制：
 *   1. 定时：每 `autoBackupIntervalHrs` 小时下载一份 .fcab 到下载目录。
 *      间隔为 0 时只保留「退出时」这一种触发，不做定点定时。
 *   2. 退出时：页面切到后台（visibilitychange → hidden）或卸载（pagehide）时下载一份。
 *
 * 实现要点：
 *   - 不依赖 React，靠 `useSettingsStore.subscribe` 监听设置变化，动态维护定时器与监听。
 *   - 在应用入口（main.tsx）调用一次 `startAutoBackup()` 即可。
 *   - 「退出时备份」是尽力而为：浏览器在 pagehide 阶段是否允许程序化下载由各浏览器决定，
 *     切后台 / 跳走通常能成功，整窗关闭不一定。这属于纯前端离线应用的固有限制。
 *
 * 下载一律走 downloadBackup（带 .fcab 文件名），失败静默吞掉——自动备份不该打扰用户。
 */
import { useSettingsStore } from '@/store'

import { downloadBackup } from './backup'

const MS_PER_HOUR = 3_600_000
/** 最短 1 分钟，避免误设极小值把主线程打爆 */
const MIN_INTERVAL_MS = 60_000
/** 退出监听去重窗口：pagehide 与 visibilitychange 在关窗时往往会先后触发 */
const EXIT_COOLDOWN_MS = 15_000

let timer: ReturnType<typeof setInterval> | null = null
let listenersBound = false
let lastExitAt = 0

function runBackup(): void {
  // 非阻塞、静默失败：自动备份不应弹出错误或阻断界面
  void downloadBackup({}).catch(() => {})
}

function onMaybeExit(): void {
  const { autoBackupEnabled, autoBackupOnExit } = useSettingsStore.getState().settings
  if (!autoBackupEnabled || !autoBackupOnExit) return
  const now = Date.now()
  if (now - lastExitAt < EXIT_COOLDOWN_MS) return
  lastExitAt = now
  runBackup()
}

/**
 * 启动自动备份守护：订阅设置变化，动态维护定时器与退出监听。
 * 在应用入口调用一次；返回的取消函数用于测试 / 主动卸载。
 */
export function startAutoBackup(): () => void {
  const sync = (): void => {
    const { autoBackupEnabled, autoBackupIntervalHrs, autoBackupOnExit } =
      useSettingsStore.getState().settings

    // 定时器：仅当开启且间隔 > 0
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    if (autoBackupEnabled && autoBackupIntervalHrs > 0) {
      const ms = Math.max(MIN_INTERVAL_MS, autoBackupIntervalHrs * MS_PER_HOUR)
      timer = setInterval(runBackup, ms)
    }

    // 退出监听：只绑定一次；关闭与否由 onMaybeExit 内部按当前开关判断
    if (!listenersBound && autoBackupEnabled && autoBackupOnExit) {
      const onVisibility = (): void => {
        if (document.visibilityState === 'hidden') onMaybeExit()
      }
      window.addEventListener('pagehide', onMaybeExit)
      document.addEventListener('visibilitychange', onVisibility)
      listenersBound = true
    }
  }

  const unsubscribe = useSettingsStore.subscribe(sync)
  sync()
  return () => {
    unsubscribe()
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}
