import { Button, EmptyState } from '@/components/ui'
import { IconCartridge, IconSearch, IconUpload } from '@/components/icons'
import { useImport } from '@/features/import/ImportContext'
import { useLibraryStore } from '@/store'

/** 库里一个游戏都没有时的引导页 */
export function LibraryEmpty() {
  const { open } = useImport()

  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <EmptyState
        icon={
          <span className="inline-flex animate-float">
            <IconCartridge size={48} />
          </span>
        }
        title="游戏库还是空的"
        description="从本地导入 .nes 文件就能开始玩。所有文件只保存在你自己的浏览器里，不会上传到任何服务器。"
        action={
          <Button variant="primary" size="lg" icon={<IconUpload size={18} />} onClick={() => open()}>
            导入 ROM 文件
          </Button>
        }
      />

      <p className="max-w-md text-center text-xs leading-relaxed text-[var(--color-text-faint)]">
        本站不提供、不内置、不分发任何游戏 ROM。请只导入你依法拥有的卡带备份，
        并遵守你所在地区的著作权法规。
      </p>
    </div>
  )
}

/** 有游戏但被筛选条件全部过滤掉时的空态 */
export function FilteredEmpty() {
  const resetFilter = useLibraryStore((s) => s.resetFilter)

  return (
      <EmptyState
        icon={
          <span className="inline-flex animate-float">
            <IconSearch size={44} />
          </span>
        }
        title="没有匹配的游戏"
      description="换个关键词，或者放宽筛选条件试试。"
      action={
        <Button variant="secondary" onClick={resetFilter}>
          清空筛选条件
        </Button>
      }
    />
  )
}
