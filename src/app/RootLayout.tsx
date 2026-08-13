import { Suspense, useState } from 'react'
import { useLocation, useOutlet } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'

import { Spinner } from '@/components/ui'
import { useReduceMotion } from '@/features/common/hooks/useReduceMotion'
import { pageVariants, pageVariantsReduced, SPRING_SOFT } from '@/features/common/motion'

import { GlobalDropZone } from './GlobalDropZone'
import { MobileTabBar } from './MobileTabBar'
import { TopNav } from './TopNav'
import { Footer } from './Footer'

/**
 * react-router 7 的数据路由没法像 <Routes location> 那样把旧位置留住，
 * 退场动画期间 <Outlet/> 会直接渲染新路由内容。
 * 这里把 outlet 在挂载瞬间存进 state 冻住，配合外层 key 换实例，旧实例就保留着旧页面。
 */
function FrozenOutlet() {
  const outlet = useOutlet()
  const [frozen] = useState(outlet)
  return <>{frozen}</>
}

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}

export function RootLayout() {
  const location = useLocation()
  const reduceMotion = useReduceMotion()

  // 播放器走沉浸式：不要导航栏、不要内边距、不要整页拖拽
  const immersive = location.pathname.startsWith('/play/')

  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      {immersive ? null : <TopNav showSearch={location.pathname === '/'} />}

      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname}
          variants={reduceMotion ? pageVariantsReduced : pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={reduceMotion ? { duration: 0.12 } : SPRING_SOFT}
          className={
            immersive
              ? 'flex min-h-dvh flex-1 flex-col'
              : 'mx-auto w-full max-w-[1600px] flex-1 px-3 pt-4 pb-28 sm:px-5 md:pb-10'
          }
        >
          <Suspense fallback={<PageFallback />}>
            <FrozenOutlet />
          </Suspense>
        </motion.main>
      </AnimatePresence>

      {immersive ? null : <Footer />}
      {immersive ? null : <MobileTabBar />}
      <GlobalDropZone enabled={!immersive} />
    </div>
  )
}
