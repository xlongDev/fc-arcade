import { useRef, useState } from 'react'

import { Button, Spinner, useToast } from '@/components/ui'
import { IconRefresh, IconTrash, IconUpload } from '@/components/icons'
import { GeneratedCover, invalidateCover, useGameCover } from '@/cover'
import { coverDao, gameDao } from '@/data'
import { notifyLibraryChanged, notifyStorageChanged } from '@/features/common/lib/storageEvents'
import { displayTitle } from '@/features/common/lib/gameDisplay'
import type { GameView } from '@/types/game'

import { COVER_ACCEPT, processCoverFile } from '../lib/coverImage'

const COVER_KIND_LABEL = {
  generated: '程序化生成',
  screenshot: '游戏内截图',
  custom: '自定义图片',
} as const

interface Props {
  game: GameView
  onChanged: () => void
}

/** 封面区：预览 + 上传自定义封面 + 恢复默认。 */
export function CoverEditor({ game, onChanged }: Props) {
  const title = displayTitle(game)
  const { url, loading } = useGameCover(game.id, title, game.coverKind)
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const applyFile = async (file: File) => {
    setBusy(true)
    try {
      const processed = await processCoverFile(file)
      await coverDao.put({
        gameId: game.id,
        kind: 'custom',
        blob: processed.blob,
        width: processed.width,
        height: processed.height,
        updatedAt: Date.now(),
      })
      await gameDao.update(game.id, { coverKind: 'custom' })
      // 让封面缓存失效，否则预览与库里仍显示旧封面
      invalidateCover(game.id)
      notifyLibraryChanged()
      notifyStorageChanged()
      onChanged()
      toast({ variant: 'success', title: '封面已更新' })
    } catch (cause) {
      console.error('[fc-arcade] 更新封面失败', cause)
      toast({
        variant: 'error',
        title: '封面更新失败',
        description: cause instanceof Error ? cause.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const resetCover = async () => {
    setBusy(true)
    try {
      await coverDao.remove(game.id)
      await gameDao.update(game.id, { coverKind: 'generated' })
      // 让封面缓存失效，否则预览与库里仍显示已删除的旧封面
      invalidateCover(game.id)
      notifyLibraryChanged()
      notifyStorageChanged()
      onChanged()
      toast({ variant: 'success', title: '已恢复默认封面' })
    } catch (cause) {
      console.error('[fc-arcade] 恢复默认封面失败', cause)
      toast({ variant: 'error', title: '恢复默认封面失败' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-surface-alt)]">
        {url !== null ? (
          <img src={url} alt="" className="size-full object-cover" draggable={false} />
        ) : loading && game.coverKind !== 'generated' ? (
          <div className="flex size-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <GeneratedCover title={title} seed={game.rom.crc32} className="absolute inset-0" />
        )}

        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg)]/60 backdrop-blur-sm">
            <Spinner />
          </div>
        ) : null}
      </div>

      <p className="text-center text-[11px] text-[var(--color-text-faint)]">
        当前封面：{COVER_KIND_LABEL[game.coverKind]}
      </p>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          disabled={busy}
          icon={<IconUpload size={14} />}
          onClick={() => inputRef.current?.click()}
        >
          上传图片
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || game.coverKind === 'generated'}
          icon={game.coverKind === 'custom' ? <IconTrash size={14} /> : <IconRefresh size={14} />}
          onClick={() => void resetCover()}
        >
          恢复默认
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={COVER_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void applyFile(file)
        }}
      />
    </div>
  )
}
