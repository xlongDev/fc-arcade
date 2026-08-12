import { lazy } from 'react'
import { createHashRouter } from 'react-router'
import type { RouteObject } from 'react-router'

import { LibraryPage } from '@/features/library/LibraryPage'

/**
 * 设置页懒加载：主题预览、键盘改键面板体积可观，且只在用户主动进入时才会用到，
 * 不能让只逛游戏库的用户为它买单。RootLayout 的 <Suspense> 会兜底它的加载态。
 */
const SettingsPage = lazy(async () => {
  const mod = await import('@/features/settings/SettingsPage')
  return { default: mod.SettingsPage }
})

import { NotFoundPage } from './NotFoundPage'
import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'

/**
 * 播放器懒加载：jsnes / fceumm 内核体积远大于界面代码，
 * 不能让只逛游戏库的用户为它买单。
 */
const PlayerPage = lazy(async () => {
  const mod = await import('@/features/player/PlayerPage')
  return { default: mod.PlayerPage }
})

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <LibraryPage /> },
      { path: 'play/:gameId', element: <PlayerPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

/**
 * 用 HashRouter：站点是纯静态托管，可能被放在任意子路径下，
 * BrowserRouter 深链刷新会直接 404。
 */
export const router = createHashRouter(routes)
