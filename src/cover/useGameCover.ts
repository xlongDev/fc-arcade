/**
 * 封面三层回退的调度。
 *
 * 优先级：① 用户上传的 custom → ② 运行时自动截图 screenshot → ③ 程序化生成。
 * 前两层是 IndexedDB 里的 Blob（covers 表一个游戏最多一行，kind 标明是哪层），
 * 第三层不落库，由 <GeneratedCover> 现场画。
 *
 * 这里只负责「现在该显示哪一层」，返回 url === null 就代表该走第三层。
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import type { CoverKind } from '@/types/game'

import {
  acquireCover,
  getCoverVersion,
  peekCover,
  releaseCover,
  subscribeCover,
} from './coverCache'

export interface GameCoverResult {
  /** 存储层封面的 objectURL；为 null 表示要用程序化封面兜底 */
  url: string | null
  /** 正在查库。为 true 且 coverKind 不是 generated 时才值得显示骨架屏 */
  loading: boolean
  /** 当前实际生效的层级 */
  kind: CoverKind
  /** 程序化封面该用的种子，直接透传给 <GeneratedCover seed> */
  seed: string
}

/**
 * @param gameId    游戏 id，同时是 covers 表的主键
 * @param title     展示标题，兼作程序化封面的兜底种子
 * @param coverKind 游戏记录上标注的封面层级。generated 时直接短路，不查库——
 *                  库里大多数游戏都没有截图，省掉这一次 IndexedDB 往返，
 *                  列表首屏就不会闪骨架屏。
 * @param seed      程序化封面的确定性种子。优先传 ROM 的 CRC32，
 *                  这样用户改游戏标题时封面也不会跟着变；不传则退回 title。
 */
export function useGameCover(
  gameId: string,
  title: string,
  coverKind: CoverKind,
  seed?: string,
): GameCoverResult {
  const stored = coverKind !== 'generated'

  // 封面被改写时 version 变化，触发重新取用
  const version = useSyncExternalStore(
    useCallback((onChange: () => void) => subscribeCover(gameId, onChange), [gameId]),
    useCallback(() => getCoverVersion(gameId), [gameId]),
  )

  const [state, setState] = useState<{ url: string | null; kind: CoverKind; loading: boolean }>(
    () => {
      const cached = stored ? peekCover(gameId) : null
      if (cached) return { url: cached.url, kind: cached.kind, loading: false }
      return { url: null, kind: 'generated', loading: stored }
    },
  )

  useEffect(() => {
    if (!stored) {
      // 与外部缓存状态同步：stored 翻转时重置派生状态，属于 effect 与异步系统同步的合法场景。
      // eslint-disable-next-line react/set-state-in-effect
      setState({ url: null, kind: 'generated', loading: false })
      return
    }

    let alive = true
    let acquired = false

    const cached = peekCover(gameId)
    if (cached) {
      setState({ url: cached.url, kind: cached.kind, loading: false })
    } else {
      setState({ url: null, kind: 'generated', loading: true })
    }

    void acquireCover(gameId).then((result) => {
      if (!alive) {
        // 组件已经卸载，拿到的引用要立刻还回去
        if (result) releaseCover(gameId)
        return
      }
      acquired = result !== null
      setState(
        result
          ? { url: result.url, kind: result.kind, loading: false }
          : { url: null, kind: 'generated', loading: false },
      )
    })

    return () => {
      alive = false
      if (acquired) releaseCover(gameId)
    }
  // version 是手动刷新触发器（如删除封面后强制重算），即便 body 不直接读取也需作为依赖。
  // eslint-disable-next-line react/exhaustive-effect-dependencies
  }, [gameId, stored, version])

  return { url: state.url, loading: state.loading, kind: state.kind, seed: seed ?? title }
}
