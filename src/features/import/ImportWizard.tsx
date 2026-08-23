import { useEffect, useRef, useState } from 'react'

import { Button, Dialog, useToast } from '@/components/ui'
import { IconAlert } from '@/components/icons'

import { CandidateList } from './components/CandidateList'
import { ImportDonePanel } from './components/ImportDonePanel'
import { ImportProgressPanel } from './components/ImportProgressPanel'
import { ImportSourcePicker } from './components/ImportSourcePicker'
import { useImportController } from './useImportController'

interface Props {
  open: boolean
  initialFiles: File[] | null
  onClose: () => void
  onImported: () => void
}

export function ImportWizard({ open, initialFiles, onClose, onImported }: Props) {
  const controller = useImportController()
  const { toast } = useToast()
  const [pickerMode, setPickerMode] = useState(true)
  const startedRef = useRef<File[] | null>(null)
  const { start, reset, phase, result } = controller

  // 打开时若外部带了文件（拖拽 / 快捷键触发），直接进解析
  useEffect(() => {
    if (!open) {
      startedRef.current = null
      reset()
      // 与 open 外部条件同步：关闭向导时复位到选择页，属于 effect 与交互状态同步。
      // eslint-disable-next-line react/set-state-in-effect
      setPickerMode(true)
      return
    }
    if (initialFiles && initialFiles.length > 0 && startedRef.current !== initialFiles) {
      startedRef.current = initialFiles
      setPickerMode(false)
      void start(initialFiles)
    }
  }, [open, initialFiles, start, reset])

  useEffect(() => {
    if (phase === 'done' && result) {
      onImported()
      toast({
        variant: result.imported > 0 ? 'success' : 'info',
        title: result.imported > 0 ? `已导入 ${result.imported} 个游戏` : '没有新增游戏',
      })
    }
  }, [phase, result, onImported, toast])

  const handleFiles = (files: File[]) => {
    setPickerMode(false)
    void start(files)
  }

  const busy = controller.phase === 'parsing' || controller.phase === 'committing'
  const showPicker = pickerMode && controller.phase === 'idle'

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="导入游戏"
      description="从本地选择 ROM 文件，全部内容只保存在你的浏览器中。"
      size="lg"
      footer={
        <ImportFooter
          phase={controller.phase}
          selectedCount={controller.stats.selectedCount}
          duplicateCount={controller.stats.duplicateCount}
          failedCount={controller.stats.failedCount}
          onCancel={onClose}
          onCommit={() => void controller.commit()}
          onDone={onClose}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {controller.error ? (
          <p className="flex items-start gap-2 rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
            <IconAlert size={16} />
            <span>{controller.error}</span>
          </p>
        ) : null}

        {controller.storageWarning ? (
          <p className="flex items-start gap-2 rounded-2xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]">
            <IconAlert size={16} />
            <span>{controller.storageWarning}</span>
          </p>
        ) : null}

        {showPicker ? <ImportSourcePicker onFiles={handleFiles} /> : null}

        {controller.phase === 'parsing' ? (
          <ImportProgressPanel progress={controller.progress} />
        ) : null}

        {controller.phase === 'review' || controller.phase === 'committing' ? (
          <CandidateList
            candidates={controller.candidates}
            selectedCount={controller.stats.selectedCount}
            onToggle={controller.toggle}
            onToggleAll={controller.toggleAll}
            onPatch={controller.patchOverrides}
            onPickMore={() => {
              controller.reset()
              setPickerMode(true)
            }}
          />
        ) : null}

        {controller.phase === 'done' && controller.result ? (
          <ImportDonePanel result={controller.result} />
        ) : null}
      </div>
    </Dialog>
  )
}

interface FooterProps {
  phase: ReturnType<typeof useImportController>['phase']
  selectedCount: number
  duplicateCount: number
  failedCount: number
  onCancel: () => void
  onCommit: () => void
  onDone: () => void
}

function ImportFooter({
  phase,
  selectedCount,
  duplicateCount,
  failedCount,
  onCancel,
  onCommit,
  onDone,
}: FooterProps) {
  if (phase === 'done') {
    return (
      <div className="flex justify-end">
        <Button variant="primary" onClick={onDone}>
          完成
        </Button>
      </div>
    )
  }

  if (phase === 'idle' || phase === 'parsing') {
    return (
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={phase === 'parsing'}>
          取消
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-[var(--color-text-muted)]">
        将导入 {selectedCount} 个
        {duplicateCount > 0 ? `，跳过 ${duplicateCount} 个重复` : ''}
        {failedCount > 0 ? `，${failedCount} 个解析失败` : ''}
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button
          variant="primary"
          loading={phase === 'committing'}
          disabled={selectedCount === 0}
          onClick={onCommit}
        >
          导入 {selectedCount} 个
        </Button>
      </div>
    </div>
  )
}
