import { BlobImage } from '@/features/common/components/BlobImage'
import { cn } from '@/lib/cn'

interface Props {
  blob: Blob | null
  className?: string
}

/** 存档缩略图，固定 NES 画面比例。 */
export function SlotThumb({ blob, className }: Props) {
  return (
    <BlobImage
      blob={blob}
      className={cn(
        'aspect-[256/240] w-full rounded-xl border border-[var(--color-border)]',
        className,
      )}
    />
  )
}
