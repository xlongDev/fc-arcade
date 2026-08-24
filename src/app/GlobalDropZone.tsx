import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'

import { IconUpload } from '@/components/icons'
import {
  collectFilesFromDataTransfer,
  dataTransferHasFiles,
} from '@/features/common/lib/fileEntries'
import { useImport } from '@/features/import/ImportContext'
import { overlayVariants, SPRING } from '@/features/common/motion'

/**
 * 整页拖拽导入。
 * 向导已经打开时让位给向导内部的拖放区，避免同一次 drop 被处理两次。
 */
export function GlobalDropZone({ enabled }: { enabled: boolean }) {
  const { open, isOpen } = useImport()
  const [active, setActive] = useState(false)
  const depth = useRef(0)

  useEffect(() => {
    if (!enabled || isOpen) {
      depth.current = 0
      // 与 enabled / isOpen 外部条件同步：关闭拖拽态，属于 effect 与交互状态同步。
      // eslint-disable-next-line react/set-state-in-effect
      setActive(false)
      return
    }

    const onDragEnter = (event: DragEvent) => {
      if (!dataTransferHasFiles(event.dataTransfer)) return
      event.preventDefault()
      depth.current += 1
      setActive(true)
    }

    const onDragOver = (event: DragEvent) => {
      if (!dataTransferHasFiles(event.dataTransfer)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }

    const onDragLeave = (event: DragEvent) => {
      if (!dataTransferHasFiles(event.dataTransfer)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setActive(false)
    }

    const onDrop = (event: DragEvent) => {
      if (!dataTransferHasFiles(event.dataTransfer)) return
      event.preventDefault()
      depth.current = 0
      setActive(false)
      const transfer = event.dataTransfer
      if (!transfer) return
      void collectFilesFromDataTransfer(transfer).then((files) => {
        if (files.length > 0) open(files)
      })
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [enabled, isOpen, open])

  return (
    <AnimatePresence>
      {active ? (
        <m.div
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-[var(--color-bg)]/70 p-6 backdrop-blur-md"
        >
          <m.div
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.96 }}
            transition={SPRING}
            className="flex flex-col items-center gap-4 rounded-[2rem] border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-glass)] px-12 py-14 text-center"
          >
            <span className="text-[var(--color-accent)]">
              <IconUpload size={52} />
            </span>
            <p className="font-pixel text-sm text-[var(--color-text)]">松手即可导入</p>
            <p className="max-w-xs text-sm text-[var(--color-text-muted)]">
              支持整个文件夹，仅识别 .nes / .fds / .unf / .unif / .zip
            </p>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}
