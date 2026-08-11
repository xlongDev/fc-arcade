import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import { cn } from '@/lib/cn'
import { NES_HEIGHT, NES_WIDTH } from '@/types/emulator'
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

/** 按容器尺寸算出保持 8:7 像素比的显示尺寸；整数缩放时向下取整到整数倍 */
function fitSize(box: Size, integerScale: boolean): Size {
  if (box.width <= 0 || box.height <= 0) return { width: NES_WIDTH, height: NES_HEIGHT }
  const scale = Math.min(box.width / NES_WIDTH, box.height / NES_HEIGHT)
  const applied = integerScale ? Math.max(1, Math.floor(scale)) : scale
  return {
    width: Math.round(NES_WIDTH * applied),
    height: Math.round(NES_HEIGHT * applied),
  }
}

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>
  filter: ScreenFilter
  integerScale: boolean
  /** 暂停时给画面加一层压暗，提示状态 */
  dimmed: boolean
  onActivate: () => void
}

/** 模拟器画面。负责等比/整数缩放与屏幕滤镜，不碰模拟器本身。 */
export function EmulatorScreen({ canvasRef, filter, integerScale, dimmed, onActivate }: Props) {
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
        className="relative shrink-0 transition-[width,height] duration-200"
        style={{ width: size.width, height: size.height }}
      >
        {/* 注意：不要在这里写 width/height 属性。
          显示 canvas 的实际像素尺寸由 NesRenderer 根据容器 CSS 尺寸和设备像素比
          动态维护。React 每次渲染都设置 width/height 会重置 WebGL/2D 绘图缓冲区，
          导致截图或控制栏显隐时出现一闪而过的黑屏。 */}
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
