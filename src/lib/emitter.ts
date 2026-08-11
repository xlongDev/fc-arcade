export type Unsubscribe = () => void

/** 极简类型安全事件总线，供模拟器适配层与输入系统使用 */
export class Emitter<Events extends Record<string, unknown>> {
  #listeners = new Map<keyof Events, Set<(payload: never) => void>>()

  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): Unsubscribe {
    let set = this.#listeners.get(event)
    if (!set) {
      set = new Set()
      this.#listeners.set(event, set)
    }
    set.add(listener as (payload: never) => void)
    return () => {
      set.delete(listener as (payload: never) => void)
    }
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.#listeners.get(event)
    if (!set) return
    for (const listener of set) {
      try {
        ;(listener as (p: Events[K]) => void)(payload)
      } catch (err) {
        console.error(`[emitter] listener for "${String(event)}" threw`, err)
      }
    }
  }

  clear(): void {
    this.#listeners.clear()
  }
}
