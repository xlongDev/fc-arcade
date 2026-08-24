import { useCallback, useEffect, useRef, useState } from 'react'
import { m } from 'motion/react'

import { Button } from '@/components/ui'
import { IconFolder, IconUpload } from '@/components/icons'
import { collectFilesFromDataTransfer, dataTransferHasFiles } from '@/features/common/lib/fileEntries'
import { ROM_ACCEPT } from '@/features/common/lib/romFiles'
import { SPRING_SNAP } from '@/features/common/motion'
import { cn } from '@/lib/cn'

interface Props {
  onFiles: (files: File[]) => void
  /** 是否监听全局粘贴。同一时刻只应有一个入口开启。 */
  listenPaste?: boolean
}

export function ImportSourcePicker({ onFiles, listenPaste = true }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const dirRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // React 的 InputHTMLAttributes 不认 webkitdirectory，只能挂 ref 手动设属性
  useEffect(() => {
    const el = dirRef.current
    if (!el) return
    el.setAttribute('webkitdirectory', '')
    el.setAttribute('directory', '')
    el.setAttribute('mozdirectory', '')
  }, [])

  const emit = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return
      const files = Array.from(list)
      if (files.length > 0) onFiles(files)
    },
    [onFiles],
  )

  useEffect(() => {
    if (!listenPaste) return
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length === 0) return
      event.preventDefault()
      onFiles(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [listenPaste, onFiles])

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragging(false)
      const files = await collectFilesFromDataTransfer(event.dataTransfer)
      emit(files)
    },
    [emit],
  )

  return (
    <div className="flex flex-col gap-4">
      <m.div
        onDragOver={(event) => {
          if (!dataTransferHasFiles(event.dataTransfer)) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        animate={{ scale: dragging ? 1.01 : 1 }}
        transition={SPRING_SNAP}
        className={cn(
          'flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          dragging
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
            : 'border-[var(--color-border)] bg-[var(--color-surface-alt)]/40',
        )}
      >
        <span className="text-[var(--color-accent)]">
          <IconUpload size={44} />
        </span>
        <div>
          <p className="text-base font-medium text-[var(--color-text)]">
            把 ROM 文件或整个文件夹拖到这里
          </p>
          <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
            支持 .nes / .fds / .unf / .unif / .zip，也可以直接按 Ctrl+V 粘贴文件
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={<IconUpload size={16} />}
            onClick={() => fileRef.current?.click()}
          >
            选择文件
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<IconFolder size={16} />}
            onClick={() => dirRef.current?.click()}
          >
            扫描文件夹
          </Button>
        </div>
      </m.div>

      <p className="text-center text-xs text-[var(--color-text-faint)]">
        本站不提供任何游戏 ROM，文件仅保存在你自己的浏览器里，不会上传。
      </p>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ROM_ACCEPT}
        className="hidden"
        onChange={(event) => {
          emit(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={dirRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          emit(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
