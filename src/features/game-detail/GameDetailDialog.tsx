import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { Badge, Button, Dialog, SegmentedControl, Spinner, useToast } from '@/components/ui'
import { IconPlay, IconRefresh, IconTrash } from '@/components/icons'
import { gameDao } from '@/data'
import { ConfirmDialog } from '@/features/common/components/ConfirmDialog'
import { displaySubtitle, displayTitle } from '@/features/common/lib/gameDisplay'
import { notifyLibraryChanged, notifyStorageChanged } from '@/features/common/lib/storageEvents'
import { reidentify } from '@/metadata'
import { CONFIDENCE_LABEL } from '@/types/game'
import type { GameView } from '@/types/game'

import { CoverEditor } from './components/CoverEditor'
import { MetaForm } from './components/MetaForm'
import { RomInfoPanel } from './components/RomInfoPanel'
import { SaveStatePanel } from './components/SaveStatePanel'
import { useGameEditor } from './useGameEditor'

type Tab = 'meta' | 'saves' | 'rom'

const TAB_OPTIONS = [
  { value: 'meta', label: '资料' },
  { value: 'saves', label: '存档' },
  { value: 'rom', label: '技术信息' },
]

interface Props {
  game: GameView | null
  open: boolean
  onClose: () => void
}

/**
 * 游戏详情 / 编辑弹窗。
 * 所有手动编辑写进 overrides，重新识别只覆盖 detected，两者互不影响。
 */
export function GameDetailDialog({ game, open, onClose }: Props) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const editor = useGameEditor(open && game ? game.id : null)

  const [tab, setTab] = useState<Tab>('meta')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reidentifying, setReidentifying] = useState(false)

  useEffect(() => {
    // 与 open 外部条件同步：打开时重置到资料页，属于 effect 与交互状态同步。
    // eslint-disable-next-line react/set-state-in-effect
    if (open) setTab('meta')
  // game?.id 变化（切换到另一个游戏）时也重置到资料页，即便 body 仅读取 open。
  // eslint-disable-next-line react/exhaustive-effect-dependencies
  }, [open, game?.id])

  if (!game) return null

  const title = displayTitle(game)
  const subtitle = displaySubtitle(game)

  const handleSave = async () => {
    const ok = await editor.save()
    if (ok) {
      toast({ variant: 'success', title: '资料已保存' })
      onClose()
    } else {
      toast({ variant: 'error', title: '保存失败', description: '数据没能写入本地库。' })
    }
  }

  const handleReidentify = async () => {
    if (!editor.record) return
    setReidentifying(true)
    try {
      const detected = await reidentify(editor.record.rom, editor.record.fileName)
      await gameDao.update(game.id, { detected })
      editor.reload()
      notifyLibraryChanged()
      toast({
        variant: 'success',
        title: '已重新识别',
        description: `识别结果：${detected.title}（${CONFIDENCE_LABEL[detected.confidence]}），你手动改过的字段保持不变。`,
      })
    } catch (cause) {
      console.error('[fc-arcade] 重新识别失败', cause)
      toast({ variant: 'error', title: '重新识别失败' })
    } finally {
      setReidentifying(false)
    }
  }

  const handleDelete = async () => {
    try {
      await gameDao.remove(game.id)
      notifyLibraryChanged()
      notifyStorageChanged()
      setConfirmDelete(false)
      onClose()
      toast({ variant: 'success', title: `已删除《${title}》` })
    } catch (cause) {
      console.error('[fc-arcade] 删除游戏失败', cause)
      toast({ variant: 'error', title: '删除失败' })
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={title}
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<IconTrash size={15} />}
              onClick={() => setConfirmDelete(true)}
            >
              删除
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>
                关闭
              </Button>
              <Button
                variant="primary"
                disabled={!editor.dirty}
                loading={editor.saving}
                onClick={() => void handleSave()}
              >
                保存修改
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <div className="flex flex-col gap-3">
            <CoverEditor game={game} onChanged={editor.reload} />
            <Button
              variant="primary"
              size="sm"
              fullWidth
              icon={<IconPlay size={15} />}
              onClick={() => {
                onClose()
                void navigate(`/play/${game.id}`)
              }}
            >
              开始游戏
            </Button>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {subtitle ? (
                <span className="truncate text-sm text-[var(--color-text-muted)]">{subtitle}</span>
              ) : null}
              {game.isEdited ? (
                <Badge variant="accent" size="sm">
                  已手动编辑 {game.editedFields.length} 项
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedControl
                value={tab}
                onChange={(next: Tab) => setTab(next)}
                options={TAB_OPTIONS}
              />
              {tab === 'meta' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={reidentifying}
                  icon={<IconRefresh size={14} />}
                  onClick={() => void handleReidentify()}
                >
                  重新识别
                </Button>
              ) : null}
            </div>

            {editor.loading || !editor.draft || !editor.record ? (
              <div className="flex min-h-48 items-center justify-center">
                <Spinner />
              </div>
            ) : tab === 'meta' ? (
              <>
                <MetaForm
                  draft={editor.draft}
                  detected={editor.record.detected}
                  onPatch={editor.patch}
                />
                <div className="flex flex-col gap-3 border-t border-[var(--color-border)] py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--color-text-faint)]">
                    {editor.editedCount > 0
                      ? `当前有 ${editor.editedCount} 个字段覆盖了识别结果`
                      : '当前完全采用识别结果'}
                  </p>
                  <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!editor.dirty}
                      onClick={editor.revert}
                    >
                      撤销改动
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={editor.editedCount === 0}
                      onClick={editor.resetToDetected}
                    >
                      全部恢复识别值
                    </Button>
                  </div>
                </div>
              </>
            ) : tab === 'saves' ? (
              <SaveStatePanel gameId={game.id} />
            ) : (
              <RomInfoPanel game={game} />
            )}
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={`删除《${title}》？`}
        description="ROM 文件、封面与全部存档都会一并从本地删除，且无法恢复。"
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
