/**
 * 截图相关的 canvas 工具。
 * 两个内核的截图路径不同（jsnes 有原始帧缓冲，nostalgist 只能拿到 RetroArch 给的 Blob），
 * 但都要落到「按倍数放大 + 编码成指定格式」这一步，所以抽到这里共用。
 */

/** 截图放大倍数上限。再大只是徒增内存，像素画本身没有更多信息。 */
const MAX_SCALE = 8

export function clampScreenshotScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(MAX_SCALE, Math.max(1, Math.round(scale)))
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('截图编码失败'))
      },
      type,
      quality,
    )
  })
}

/**
 * 把已有的图片 Blob 按倍数放大并转码。
 * 倍数为 1 且格式已经一致时直接返回原 Blob，省掉一次解码 + 编码。
 */
export async function rescaleBlob(
  source: Blob,
  scale: number,
  type: string,
  quality?: number,
): Promise<Blob> {
  const factor = clampScreenshotScale(scale)
  if (factor === 1 && source.type === type) return source

  const bitmap = await createImageBitmap(source)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width * factor
    canvas.height = bitmap.height * factor
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('无法创建截图上下文')
    // 像素画放大必须关掉插值，否则会糊成一片
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await canvasToBlob(canvas, type, quality)
  } finally {
    bitmap.close()
  }
}
