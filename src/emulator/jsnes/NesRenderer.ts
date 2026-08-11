/**
 * jsnes 帧缓冲 → canvas 的渲染器。
 *
 * 关键点：
 * - jsnes 给的是 256×240 的 Uint32 缓冲，像素格式 0x00BBGGRR。小端序下这块内存
 *   按字节读正好是 R,G,B,A，所以补上 0xff000000 之后可以直接 set 进 ImageData，
 *   不需要逐通道拆装。
 * - 先画到 256×240 的离屏 canvas，再 drawImage 放大到显示 canvas。
 *   两级绘制让「截图」和「显示」共用同一份原始像素。
 * - imageSmoothingEnabled = false 保证放大后仍是硬边像素。
 */
import { NES_HEIGHT, NES_WIDTH } from '@/types/emulator'
import { canvasToBlob, clampScreenshotScale } from '@/emulator/shared/canvas'

/** 设备像素比上限。像素画放大到 3x 之外没有额外收益，只会白白增加填充率。 */
const MAX_DPR = 3

export class NesRenderer {
  readonly #source: HTMLCanvasElement
  readonly #sourceCtx: CanvasRenderingContext2D
  readonly #imageData: ImageData
  readonly #pixels: Uint32Array

  #target: HTMLCanvasElement | null = null
  #targetCtx: CanvasRenderingContext2D | null = null
  #observer: ResizeObserver | null = null
  #integerScale = false
  #dirty = false

  constructor() {
    const source = document.createElement('canvas')
    source.width = NES_WIDTH
    source.height = NES_HEIGHT
    const ctx = source.getContext('2d', { alpha: false, willReadFrequently: false })
    if (!ctx) throw new Error('无法创建 2D 渲染上下文')

    this.#source = source
    this.#sourceCtx = ctx
    this.#imageData = ctx.createImageData(NES_WIDTH, NES_HEIGHT)
    this.#pixels = new Uint32Array(this.#imageData.data.buffer)
    this.#pixels.fill(0xff000000)
  }

  /** 原始 256×240 画面，截图与 present 都从这里取 */
  get sourceCanvas(): HTMLCanvasElement {
    return this.#source
  }

  setIntegerScale(enabled: boolean): void {
    this.#integerScale = enabled
    this.present(true)
  }

  attach(canvas: HTMLCanvasElement, integerScale: boolean): void {
    this.detachTarget()
    this.#target = canvas
    this.#integerScale = integerScale
    const ctx = canvas.getContext('2d', { alpha: false })
    this.#targetCtx = ctx

    if (ctx) ctx.imageSmoothingEnabled = false

    // 由渲染器根据 CSS 尺寸维护绘制缓冲区大小，上层只需要用 CSS 控制布局
    if (typeof ResizeObserver !== 'undefined') {
      this.#observer = new ResizeObserver(() => {
        this.#syncBackingStore()
        this.present(true)
      })
      this.#observer.observe(canvas)
    }
    this.#syncBackingStore()
    this.present(true)
  }

  /**
   * 写入一帧。framebuffer 长度必须是 256×240。
   * 只标脏不绘制 —— 一次 rAF 里可能跑多帧，只有最后一帧需要真正上屏。
   */
  writeFrame(framebuffer: Int32Array | Uint32Array | number[]): void {
    const pixels = this.#pixels
    const count = Math.min(pixels.length, framebuffer.length)
    for (let i = 0; i < count; i++) {
      pixels[i] = 0xff000000 | framebuffer[i]
    }
    this.#dirty = true
  }

  /** 把脏帧刷到显示 canvas。force 用于尺寸变化后的重绘。 */
  present(force = false): void {
    if (force) {
      // 强制重绘时始终重新上传像素：浏览器在标签页隐藏 / 内存紧张时
      // 可能丢弃 2D canvas 的 backing store，#dirty 为 false 也会黑屏。
      this.#dirty = true
    }
    if (!this.#dirty) return
    this.#sourceCtx.putImageData(this.#imageData, 0, 0)
    this.#dirty = false

    const target = this.#target
    const ctx = this.#targetCtx
    if (!target || !ctx) return

    const cw = target.width
    const ch = target.height
    if (cw === 0 || ch === 0) return

    let width: number
    let height: number
    if (this.#integerScale) {
      const scale = Math.max(1, Math.floor(Math.min(cw / NES_WIDTH, ch / NES_HEIGHT)))
      width = NES_WIDTH * scale
      height = NES_HEIGHT * scale
    } else {
      const scale = Math.min(cw / NES_WIDTH, ch / NES_HEIGHT)
      width = Math.round(NES_WIDTH * scale)
      height = Math.round(NES_HEIGHT * scale)
    }

    const x = Math.round((cw - width) / 2)
    const y = Math.round((ch - height) / 2)

    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, cw, ch)
    ctx.drawImage(this.#source, x, y, width, height)
  }

  /** 清成黑屏（dispose / 换 ROM 时） */
  clear(): void {
    this.#pixels.fill(0xff000000)
    this.#dirty = true
    this.present(true)
  }

  /** 按倍数放大原始画面并导出。scale 会被限制在 1~8。 */
  async screenshot(scale: number, type: string, quality?: number): Promise<Blob> {
    // 先确保 #source 是最新一帧（运行中本来每 tick 都会 present，这里再兜一次底，
    // 避免极端时序下拿到空白缓冲）。不会影响可见画布。
    this.present(true)
    // 从 #source 而不是显示 canvas 取图：显示 canvas 带 DPR 缩放和黑边，
    // 而封面图需要的是干净的 256×240 整数倍放大结果
    const factor = clampScreenshotScale(scale)
    const canvas = document.createElement('canvas')
    canvas.width = NES_WIDTH * factor
    canvas.height = NES_HEIGHT * factor
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('无法创建截图上下文')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.#source, 0, 0, canvas.width, canvas.height)

    return await canvasToBlob(canvas, type, quality)
  }

  detachTarget(): void {
    this.#observer?.disconnect()
    this.#observer = null
    this.#target = null
    this.#targetCtx = null
  }

  dispose(): void {
    this.detachTarget()
    this.#source.width = 0
    this.#source.height = 0
  }

  #syncBackingStore(): void {
    const target = this.#target
    if (!target) return
    const dpr = Math.min(MAX_DPR, Math.max(1, globalThis.devicePixelRatio || 1))
    const cssWidth = target.clientWidth
    const cssHeight = target.clientHeight
    // 元素尚未布局（宽高为 0）时不动它的 width/height，避免把画布擦成空白
    if (cssWidth <= 0 || cssHeight <= 0) return

    const width = Math.max(1, Math.round(cssWidth * dpr))
    const height = Math.max(1, Math.round(cssHeight * dpr))
    if (target.width !== width) target.width = width
    if (target.height !== height) target.height = height
    if (this.#targetCtx) this.#targetCtx.imageSmoothingEnabled = false
  }
}
