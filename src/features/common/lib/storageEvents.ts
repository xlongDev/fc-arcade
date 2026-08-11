/**
 * 跨 feature 的轻量广播。
 *
 * 导入、删除、编辑、清空数据这些动作分散在不同 feature 里，
 * 而导航栏用量指示器、游戏库列表都要跟着刷新。为此再拉一个全局 store 太重，
 * 用 window 自定义事件是成本最低且不引入耦合的做法。
 */
const STORAGE_CHANGED = 'fc-arcade:storage-changed'
const LIBRARY_CHANGED = 'fc-arcade:library-changed'

function emit(name: string): void {
  window.dispatchEvent(new CustomEvent(name))
}

function subscribe(name: string, handler: () => void): () => void {
  window.addEventListener(name, handler)
  return () => window.removeEventListener(name, handler)
}

/** 占用空间发生变化（导入 / 删除 / 清空 / 写存档） */
export function notifyStorageChanged(): void {
  emit(STORAGE_CHANGED)
}

export function onStorageChanged(handler: () => void): () => void {
  return subscribe(STORAGE_CHANGED, handler)
}

/** 游戏条目集合或元数据发生变化，列表需要重新拉取 */
export function notifyLibraryChanged(): void {
  emit(LIBRARY_CHANGED)
  emit(STORAGE_CHANGED)
}

export function onLibraryChanged(handler: () => void): () => void {
  return subscribe(LIBRARY_CHANGED, handler)
}
