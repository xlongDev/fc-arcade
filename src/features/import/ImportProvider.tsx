import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { notifyLibraryChanged } from '@/features/common/lib/storageEvents'

import { ImportContext } from './ImportContext'
import type { ImportContextValue } from './ImportContext'

/**
 * 导入向导懒加载：它整把识别管线（matcher / importer / fflate）与全部候选组件都拽在身上，
 * 但绝大多数用户只在主动导入 ROM 时才需要。Provider 维持 context 常驻（导航栏、空态、拖拽都能触发），
 * 真正的向导 chunk 等到第一次真正 `open` 时再拉取，绝不进首屏。
 */
const ImportWizard = lazy(async () => {
  const mod = await import('./ImportWizard')
  return { default: mod.ImportWizard }
})

/**
 * 导入向导挂在应用根部：导航栏按钮、游戏库空态、整页拖拽都能触发同一个实例，
 * 不会出现两个向导互相抢文件的情况。
 */
export function ImportProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [files, setFiles] = useState<File[] | null>(null)

  const open = useCallback((next?: File[]) => {
    setFiles(next && next.length > 0 ? next : null)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setFiles(null)
  }, [])

  const value = useMemo<ImportContextValue>(
    () => ({ isOpen, open, close }),
    [isOpen, open, close],
  )

  return (
    <ImportContext.Provider value={value}>
      {children}
      {isOpen ? (
        <Suspense fallback={null}>
          <ImportWizard
            open={isOpen}
            initialFiles={files}
            onClose={close}
            onImported={notifyLibraryChanged}
          />
        </Suspense>
      ) : null}
    </ImportContext.Provider>
  )
}
