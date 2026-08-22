import { useEffect, useRef, useState } from 'react'
import type { Ref } from 'react'

import { cn } from '@/lib/cn'
import { NES_HEIGHT, NES_WIDTH } from '@/types/emulator'
import type { AspectRatio, ScreenFilter } from '@/types/ui'

/** 滤镜叠加层。纯 CSS，不占 GPU 纹理，切换零成本。 */
const FILTER_CLASS: Readonly<Record<ScreenFilter, string>> = {
  none: '',
  scanline:
    'bg-[repeating-linear-gradient(to_bottom,rgba(0,0,0,0.28)_0px,rgba(0,0,0,0.28)_1px,transparent_1px,transparent_3px)]',
  crt: 'bg-[repeating-linear-gradient(to_bottom,rgba(0,0,0,0.32)_0px,rgba(0,0,0,0.32)_1px,transparent_1px,transparent_3px)] shadow-[inset_0_0_120px_rgba(0,0,0,0.65)]',
  lcd: 'bg-[repeating-linear-gradient(to_right,rgba(0,0,0,0.16)_0px,rgba(0,0,0,0.16)_1px,transparent_1px,transparent_3px)] opacity-80',
}

interface Size {
  width: number
  height: number
}

/** NES 原始像素宽高比。256:240 ≈ 1.0667，是「原始」比例的基准。 */
const ORIGINAL_RATIO = NES_WIDTH / NES_HEIGHT

/**
 * 按容器尺寸与目标宽高比算出显示尺寸。
 *
 * - original / crt：使用 **cover** 策略填满容器，按目标比例裁剪，不再留黑边。
 * - stretch：忽略原始比例，拉伸到容器比例，完全填满但可能变形。
 *
 * 整数倍缩放时，scale 向下取整到整数倍，保持像素锐利；此时若容器不是整数倍
 * 对齐，仍可能留少量黑边，这是整数缩放的固有 trade-off。
 */
function fitSize(box: Size, integerScale: boolean, aspectRatio: AspectRatio): Size {
  if (box.width <= 0 || box.height <= 0) {
    return { width: NES_WIDTH, height: NES_HEIGHT }
  }

  const targetRatio = aspectRatio === 'stretch' ? box.width / box.height : aspectRatio === 'crt' ? 4 / 3 : ORIGINAL_RATIO
  const baseWidth = NES_HEIGHT * targetRatio

  // 非整数倍时使用 cover，让画面完全填满容器，去除上下/左右黑边；
  // 整数倍时退回到 contain，优先保证像素不模糊。
  const rawScale = integerScale
    ? Math.min(box.width / baseWidth, box.height / NES_HEIGHT)
    : Math.max(box.width / baseWidth, box.height / NES_HEIGHT)
  const applied = integerScale ? Math.max(1, Math.floor(rawScale)) : rawScale

  return {
    width: Math.round(baseWidth * applied),
    height: Math.round(NES_HEIGHT * applied),
  }
}

interface Props {
  canvasRef: Ref<HTMLCanvasElement | null>
  filter: ScreenFilter
  integerScale: boolean
  aspectRatio: AspectRatio
  /** 暂停时给画面加一层压暗，提示状态 */
  dimmed: boolean
  /** 全屏模式下去掉圆角，让画面真正铺满 */
  fullscreen?: boolean
  onActivate: () => void
}

/** 模拟器画面。负责等比/整数缩放与屏幕滤镜，不碰模拟器本身。 */
export function EmulatorScreen({
  canvasRef,
  filter,
  integerScale,
  aspectRatio,
  dimmed,
  fullscreen = false,
  onActivate,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = boxRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const rect = entry.contentRect
      setBox({ width: rect.width, height: rect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const size = fitSize(box, integerScale, aspectRatio)

  return (
    <div
      ref={boxRef}
      className="relative flex size-full items-center justify-center overflow-hidden bg-bg"
      onPointerDown={onActivate}
    >
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden transition-[width,height] duration-200',
          // 非全屏时给画面加一层「嵌在机壳里」的质感：
          // 外圈 1px 浅边 + 内侧 2px 暗色 bezel 环 + 柔和投影。纯 box-shadow，不占 GPU 纹理，
          // 不影响整数缩放性能。
          fullscreen
            ? 'rounded-none'
            : 'rounded-2xl [box-shadow:0_22px_70px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.06),inset_0_0_0_2px_rgba(0,0,0,0.45)]',
        )}
        style={{ width: size.width, height: size.height }}
      >
        {/*
          canvas 的 CSS 尺寸与外层 div 一致，由浏览器把适配器输出的 256x240 纹理
          拉伸/映射到目标显示尺寸。不同 aspectRatio 下：
          - original：256:240 1:1 映射，无拉伸
          - crt：水平拉伸到 4:3
          - stretch：拉伸到容器比例

          注意：不要在这里写 width/height 属性。
          显示 canvas 的实际像素尺寸由模拟器适配器（NostalgistAdapter 经 ResizeObserver）
          根据容器 CSS 尺寸和设备像素比动态维护。React 每次渲染都设置 width/height 会
          重置 WebGL/2D 绘图缓冲区，导致截图或控制栏显隐时出现一闪而过的黑屏。
        */}
        <canvas
          ref={canvasRef}
          className="block size-full [image-rendering:pixelated]"
        />
        {filter === 'none' ? null : (
          <div
            aria-hidden
            className={cn('pointer-events-none absolute inset-0', FILTER_CLASS[filter])}
          />
        )}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 bg-black transition-opacity duration-300',
            dimmed ? 'opacity-55' : 'opacity-0',
          )}
        />
      </div>
    </div>
  )
}
