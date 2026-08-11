/** 自定义封面预处理：等比缩放到合理尺寸再落库，避免用户拖进来一张 8MB 的原图撑爆配额。 */

export const COVER_MAX_EDGE = 640
export const COVER_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif'
/** 原始文件大小上限，超过直接拒绝，不进解码 */
export const COVER_MAX_INPUT_BYTES = 20 * 1024 * 1024

export interface ProcessedCover {
  blob: Blob
  width: number
  height: number
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

export async function processCoverFile(
  file: File,
  maxEdge: number = COVER_MAX_EDGE,
): Promise<ProcessedCover> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }
  if (file.size > COVER_MAX_INPUT_BYTES) {
    throw new Error('图片太大了，请换一张 20MB 以内的')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (cause) {
    throw new Error('图片解码失败，可能是格式不受支持', { cause })
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('浏览器不支持 Canvas 2D，无法处理封面')
    ctx.drawImage(bitmap, 0, 0, width, height)

    const webp = await toBlob(canvas, 'image/webp', 0.9)
    const blob = webp ?? (await toBlob(canvas, 'image/png', 1))
    if (!blob) throw new Error('封面编码失败')

    return { blob, width, height }
  } finally {
    bitmap.close()
  }
}
