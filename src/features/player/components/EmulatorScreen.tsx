import { useEffect, useRef, useState } from 'react'
import type { Ref } from 'react'

import { cn } from '@/lib/cn'
import { NES_VISIBLE_HEIGHT, NES_VISIBLE_WIDTH, NES_WIDTH } from '@/types/emulator'
import type { ScreenFilter } from '@/types/ui'

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

/**
 * 按容器尺寸算出保持像素比的显示尺寸；整数缩放时向下取整到整数倍。
 *
 * 计算基准用 NES_VISIBLE_*（已裁掉左右过扫描），因为最终用户看到的
 * 就是 240x240 的有效区域；canvas 实际纹理仍是 256x240，由父容器
 * overflow-hidden 把两侧 8px 裁掉。
 */
function fitSize(box: Size, integerScale: boolean): Size {
  if (box.width <= 0 || box.height <= 0) {
    return { width: NES_VISIBLE_WIDTH, height: NES_VISIBLE_HEIGHT }
  }
  const scale = Math.min(box.width / NES_VISIBLE_WIDTH, box.height / NES_VISIBLE_HEIGHT)
  const applied = integerScale ? Math.max(1, Math.floor(scale)) : scale
  return {
    width: Math.round(NES_VISIBLE_WIDTH * applied),
    height: Math.round(NES_VISIBLE_HEIGHT * applied),
  }
}

interface Props {
  canvasRef: Ref<HTMLCanvasElement | null>
  filter: ScreenFilter
  integerScale: boolean
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

  const size = fitSize(box, integerScale)

  return (
    <div
      ref={boxRef}
      className="relative flex size-full items-center justify-center overflow-hidden bg-black"
      onPointerDown={onActivate}
    >
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden transition-[width,height] duration-200',
          fullscreen ? 'rounded-none' : 'rounded-2xl shadow-[0_0_0_1px_rgba(255,255,255,0.06)] shadow-2xl',
        )}
        style={{ width: size.width, height: size.height }}
      >
        {/* 注意：不要在这里写 width/height 属性。
          显示 canvas 的实际像素尺寸由模拟器适配器（NostalgistAdapter 经 ResizeObserver）
          根据容器 CSS 尺寸和设备像素比动态维护。React 每次渲染都设置 width/height 会
          重置 WebGL/2D 绘图缓冲区，导致截图或控制栏显隐时出现一闪而过的黑屏。

          宽度特意大于父容器：模拟器输出 256x240，但左右各 8px 是过扫描区，
          由父容器 overflow-hidden 裁掉，只显示中间 240x240。 */}
        <canvas
          ref={canvasRef}
          className="block h-full [image-rendering:pixelated]"
          style={{
            width: Math.round(size.width * (NES_WIDTH / NES_VISIBLE_WIDTH)),
          }}
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
