import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, Ref } from 'react'

import { cn } from '@/lib/cn'
import { NES_HEIGHT, NES_WIDTH } from '@/types/emulator'
import type { AspectRatio, ScreenFilter } from '@/types/ui'

/** 滤镜叠加层。纯 CSS，不占 GPU 纹理，切换零成本。 */
const FILTER_CLASS: Readonly<Record<ScreenFilter, string>> = {
  none: '',
  scanline:
    'bg-[repeating-linear-gradient(to_bottom,rgba(0,0,0,0.28)_0px,rgba(0,0,0,0.28)_1px,transparent_1px,transparent_3px)]',
  crt: 'bg-[repeating-linear-gradient(to_bottom,rgba(0,0,0,0.32)_0px,rgba(0,0,0,0.32)_1px,transparent_1px,transparent_3px)] shadow-[inset_0_0_120px_rgba(0,0,0,0.65)]',
  lcd: 'bg-[repeating-linear-gradient(to_right,rgba(0,0,0,0.16)_0px,rgba(0,0,0,0.16)_1px,transparent_1px,transparent_1px,transparent_3px)] opacity-80',
}

interface Size {
  width: number
  height: number
}

/** NES 显示宽高比（PAR 8:7 + 去掉 vblank 的 224 活动行）：
 *  width × PAR / height = 256 × 8/7 / 224 ≈ 1.3061。
 *  这个值必须与 NostalgistAdapter 喂给 RetroArch 的 video_aspect_ratio 完全一致：
 *  三个比例（fceumm 实际 framebuffer 物理像素比例、retroarch content aspect、
 *  EmulatorScreen CSS box 比例）相同，1:1 充满，0 黑边。
 *  之前用 1.143 (256/224) 是把 NES 像素当正方形算，没把 8:7 PAR 计进去，导致
 *  canvas 与 retroarch content aspect 错位（content 1.3061 > canvas 1.1425
 *  → retroarch 在 canvas 上下各加 6.3% letterbox 黑条），实测表现为"上下黑边"。 */
const ORIGINAL_RATIO = (NES_WIDTH * (8 / 7)) / (NES_HEIGHT - 16)

/**
 * 按容器尺寸与目标宽高比算出画布外框显示尺寸。
 *
 * **画布外框永远按 NES 游戏比例**（original=256:240，crt=4:3），不跟随 fceumm canvas
 * 的任意比例——fceumm 会把 canvas framebuffer 自动缩放到 CSS 尺寸的比例（例如用户窗口
 * 是竖屏 625×754 时 framebuffer 变成 0.83 竖屏，NES 横屏内容在里面被 fceumm 自己
 * letterbox 出上下黑边）。
 *
 * 处理方式：
 * - boxRef 固定 NES 比例，canvas 用 `object-cover` 充满 boxRef，把 fceumm 内部
 *   letterbox 黑边**裁掉**，画面保持 NES 比例、无黑边。
 * - 非整数倍：canvas wrapper = boxRef（充满）。
 * - 整数倍：按 NES 比例做整数 contain，居中 boxRef（像素锐利的 trade-off）。
 */
function fitSize(box: Size, integerScale: boolean, aspectRatio: AspectRatio): Size {
  if (box.width <= 0 || box.height <= 0) {
    return { width: NES_WIDTH, height: NES_HEIGHT }
  }

  if (aspectRatio === 'stretch') {
    if (integerScale) {
      const scale = Math.max(1, Math.floor(Math.max(box.width / NES_WIDTH, box.height / NES_HEIGHT)))
      return { width: NES_WIDTH * scale, height: NES_HEIGHT * scale }
    }
    return { width: box.width, height: box.height }
  }

  // 非整数倍：canvas wrapper = boxRef
  if (!integerScale) {
    return { width: box.width, height: box.height }
  }

  // 整数倍：按 NES 目标比例做整数 contain
  // base 必须用「去 vblank」的 NES_WIDTH × (NES_HEIGHT-16)，与 ORIGINAL_RATIO / crt 比例一致；
  // 之前这里写成 baseWidth = NES_HEIGHT * targetRatio + scale × NES_HEIGHT（240 行），
  // 整除 base 高度按 240 算，会和 ORIGINAL_RATIO（基于 224）错位 16 行，画面被多拉伸一行。
  const baseWidth = NES_WIDTH
  const baseHeight = NES_HEIGHT - 16
  const scale = Math.max(
    1,
    Math.min(Math.floor(box.width / baseWidth), Math.floor(box.height / baseHeight)),
  )
  return { width: Math.round(baseWidth * scale), height: Math.round(baseHeight * scale) }
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
  // 初始 = NES visible 256:224（不带 DPR），让 fceumm 启动时看到的 canvas CSS 已经是
  // NES 比例 → framebuffer = 256×224（1.143），不会被后续 ResizeObserver 覆盖。
  const [box, setBox] = useState<Size>({ width: NES_WIDTH, height: NES_HEIGHT - 16 })

  useEffect(() => {
    // 测 wrapper（boxRef 父）尺寸变化，驱动 box 显式计算
    const wrapper = boxRef.current?.parentElement
    if (!wrapper) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const rect = entry.contentRect
      if (fullscreen) {
        // 全屏模式：画布必须占满整个屏幕（用户期望"游戏占满上下"）。
        // 不应用 1100 / 0.88vh 上限，box 直接取 wrapper 实际尺寸；
        // canvas size-full 后 fceumm framebuffer 按 retroarch video_aspect_ratio
        // 渲染填满，无 letterbox、无黑边。
        setBox({ width: rect.width, height: rect.height })
        return
      }
      // 非全屏：保留 1100 / 0.88vh 上限防止画布在桌面端过大。
      // 显式计算 boxRef 尺寸：width 撑满 max-w、height 由 aspect-ratio 推导、
      // 再受 max-h 限制。不能用 CSS aspect-ratio + max-w 同时设，会被 max-w 截断
      // 破坏比例（实测 1100×754=1.46 实际是 1.067 的 boxRef）。
      const compactMaxW = Math.min(rect.width, 1100)
      const compactMaxH = Math.min(rect.height, window.innerHeight * 0.88)
      const targetRatio = aspectRatio === 'crt' ? 4 / 3 : ORIGINAL_RATIO
      const aspectH = compactMaxW * (1 / targetRatio)
      let finalW: number
      let finalH: number
      if (aspectH <= compactMaxH) {
        finalW = compactMaxW
        finalH = aspectH
      } else {
        finalH = compactMaxH
        finalW = compactMaxH * targetRatio
      }
      if (finalW < 1 || finalH < 1) {
        finalW = NES_WIDTH
        finalH = NES_HEIGHT
      }
      setBox({ width: finalW, height: finalH })
    })
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [aspectRatio, fullscreen])

  const size = fitSize(box, integerScale, aspectRatio)

  // boxRef 显式 width/height（JS 计算，不依赖 CSS aspect-ratio）。
  const isStretch = aspectRatio === 'stretch'
  const compact = !fullscreen && !isStretch
  // fullscreen：boxRef 必须铺满 wrapper（=整个屏幕），让画布占满上下。
  // stretch：同上；其他：用 ORIGINAL_RATIO 推导的 box 尺寸（保留 1100/0.88vh 上限）。
  const boxStyle: CSSProperties =
    fullscreen || isStretch
      ? { width: '100%', height: '100%' }
      : { width: box.width, height: box.height }

  const boxClassName = fullscreen || isStretch
    ? 'relative flex size-full items-center justify-center overflow-hidden'
    : 'relative flex items-center justify-center'

  return (
    // 外层 wrapper：居中 + 给顶/底栏（absolute 浮岛）让出 padding。
    // 非全屏时保留 pt-12 pb-20 让画布与浮岛保持呼吸空间；
    // 全屏 / stretch 时 padding 归零，让画布真正贴到屏幕边缘占满。
    <div
      className={cn(
        'relative flex size-full items-center justify-center overflow-hidden bg-bg px-3 sm:px-6',
        compact ? 'pt-12 pb-20' : 'p-0',
      )}
      onPointerDown={onActivate}
    >
      <div
        ref={boxRef}
        // boxRef 必须有显式高度（h-full 取父容器 contentRect），否则
        // fitSize fallback 256×240 → boxRef 被内容反向锁死，画布卡在 ~200。
        className={boxClassName}
        style={boxStyle}
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
            canvas CSS 尺寸 = 父级 wrapper = boxRef 尺寸，由 NostalgistAdapter 配合
            retroarchConfig (video_crop_overscan: true + video_aspect_ratio_auto: false
            + video_aspect_ratio: '1.1429') 强制 fceumm framebuffer 比例 = NES visible
            256:224（≈1.143），与 boxRef 比例 1:1 对齐、无 letterbox、无黑边。
            不再用 object-cover：之前 fceumm 启用了 PAR 自动调整会把 224 行 framebuffer
            letterbox 到 4:3 content 比例，导致画布上下 32 行黑色。
            image-rendering: pixelated 保持像素锐利。
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
    </div>
  )
}
