import { useEffect, useState } from 'react'

import { cn } from '@/lib/cn'

interface Props {
  blob: Blob | null
  alt?: string
  /** 外层容器类名，用来控制尺寸与圆角 */
  className?: string
  /** 像素画面（截图 / 存档缩略图）关掉插值 */
  pixelated?: boolean
}

/**
 * 把 Blob 渲染成图片。
 * objectURL 在 blob 变化和卸载时都会 revoke——存档列表里几十张缩略图不回收会直接吃掉内存。
 */
export function BlobImage({ blob, alt = '', className, pixelated = true }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      // 与外部传入的 blob 同步；blob 变化或卸载时清空并回收 objectURL，避免内存泄漏。
      // eslint-disable-next-line react/set-state-in-effect
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])

  return (
    <div className={cn('overflow-hidden bg-black/60', className)}>
      {url ? (
        <img
          src={url}
          alt={alt}
          className={cn('size-full object-cover', pixelated && '[image-rendering:pixelated]')}
        />
      ) : null}
    </div>
  )
}
