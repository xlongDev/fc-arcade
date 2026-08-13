/**
 * 程序化封面——封面三层回退的最后一层。
 *
 * 输出 inline SVG 而不是 canvas：矢量可以无损缩放到从 74px 的列表缩略图
 * 到整屏的封面墙，体积只有几 KB，而且能直接吃主题的 CSS 变量。
 * 所有随机性都来自种子 hash，同一游戏在任何设备上都是同一张图。
 */
import type { CSSProperties, ReactNode } from 'react'
import { memo, useId, useMemo } from 'react'

import { cn } from '@/lib/cn'

import type { CoverSeed } from './hash'
import { coverInitials, createRng, deriveCover, isCjkText } from './hash'
import { COVER_CLASS, coverVars, ensureCoverStyles } from './palette'

// 与主题一样，样式表在模块加载时就注入，避免首帧封面没有颜色
ensureCoverStyles()

/** 4:3 的画布。库里所有布局的封面槽位都是 4:3，竖版容器靠 slice 裁切两侧。 */
const VB_W = 240
const VB_H = 180

const INK = `${COVER_CLASS}-ink`
const INK_STROKE = `${COVER_CLASS}-ink-s`

export interface GeneratedCoverProps {
  /** 展示标题，同时决定中央叠印的文字 */
  title: string
  /**
   * 决定图案与配色的稳定标识。优先传 ROM 的 CRC32——
   * 这样用户改了标题封面也不会变。缺省退回用 title 当种子。
   */
  seed?: string
  /** 是否叠印标题文字。列表缩略图这类小尺寸场景关掉更干净。 */
  showTitle?: boolean
  className?: string
}

/* ------------------------------- 图案生成 ------------------------------- */

function buildPattern(cover: CoverSeed): ReactNode[] {
  // 单独开一条随机流，保证本函数是纯函数：同一个 cover 调多少次结果都一样
  const rng = createRng(cover.hash ^ 0x9e37_79b9)
  const { cell, density, pattern, flip } = cover
  const nodes: ReactNode[] = []

  switch (pattern) {
    case 'blocks': {
      const cols = VB_W / cell
      const rows = VB_H / cell
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (rng() > density) continue
          nodes.push(
            <rect
              key={`b${row}-${col}`}
              className={INK}
              x={col * cell}
              y={row * cell}
              width={cell}
              height={cell}
              opacity={0.1 + rng() * 0.26}
            />,
          )
        }
      }
      break
    }

    case 'stripes': {
      const gap = cell + 6
      const dir = flip ? -1 : 1
      for (let i = -VB_H; i < VB_W + VB_H; i += gap) {
        nodes.push(
          <path
            key={`s${i}`}
            className={INK_STROKE}
            strokeWidth={cell * 0.34}
            opacity={0.1 + (i % 3 === 0 ? 0.14 : 0)}
            d={`M${i} 0 L${i + dir * VB_H} ${VB_H}`}
          />,
        )
      }
      break
    }

    case 'checker': {
      const size = cell
      const cols = VB_W / size
      const rows = VB_H / size
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if ((row + col) % 2 === (flip ? 1 : 0)) continue
          nodes.push(
            <rect
              key={`c${row}-${col}`}
              className={INK}
              x={col * size}
              y={row * size}
              width={size}
              height={size}
              opacity={0.08 + (row / rows) * 0.16}
            />,
          )
        }
      }
      break
    }

    case 'rings': {
      const cx = flip ? VB_W * 0.24 : VB_W * 0.76
      const cy = VB_H * 0.3
      for (let i = 1; i <= 7; i += 1) {
        nodes.push(
          <circle
            key={`r${i}`}
            className={INK_STROKE}
            cx={cx}
            cy={cy}
            r={i * (cell * 0.9)}
            strokeWidth={cell * 0.28}
            opacity={0.2 - i * 0.02}
          />,
        )
      }
      break
    }

    case 'stars': {
      const count = 28 + Math.floor(density * 40)
      const unit = cell / 4
      for (let i = 0; i < count; i += 1) {
        // 吸附到像素网格，散点也要有颗粒感
        const x = Math.floor(rng() * (VB_W / unit)) * unit
        const y = Math.floor(rng() * (VB_H / unit)) * unit
        const big = rng() > 0.78
        nodes.push(
          <rect
            key={`t${i}`}
            className={INK}
            x={x}
            y={y}
            width={big ? unit * 2 : unit}
            height={big ? unit * 2 : unit}
            opacity={0.24 + rng() * 0.4}
          />,
        )
      }
      break
    }

    case 'bricks': {
      const bw = cell * 2
      const bh = cell
      const rows = VB_H / bh
      for (let row = 0; row < rows; row += 1) {
        const offset = row % 2 === 0 ? 0 : -bw / 2
        for (let x = offset; x < VB_W; x += bw) {
          nodes.push(
            <rect
              key={`k${row}-${x}`}
              className={INK}
              x={x + 1}
              y={row * bh + 1}
              width={bw - 2}
              height={bh - 2}
              rx={2}
              opacity={row % 2 === 0 ? 0.14 : 0.09}
            />,
          )
        }
      }
      break
    }
  }

  return nodes
}

/** 左下角那排像素小方块，模拟卡带贴纸上的批号色条 */
function buildCodeStrip(cover: CoverSeed): ReactNode[] {
  const rng = createRng(cover.hash ^ 0x5bf0_3635)
  return Array.from({ length: 6 }, (_, i) => (
    <rect
      key={`code${i}`}
      className={INK}
      x={14 + i * 9}
      y={VB_H - 20}
      width={6}
      height={6}
      opacity={rng() > 0.45 ? 0.85 : 0.3}
    />
  ))
}

/* -------------------------------- 组件 --------------------------------- */

function GeneratedCoverImpl({ title, seed, showTitle = true, className }: GeneratedCoverProps) {
  // useId 带冒号，直接塞进 url(#…) 在部分实现里会踩坑，先洗一遍
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const key = seed ?? title

  const cover = useMemo(() => deriveCover(key), [key])
  const vars = useMemo(() => coverVars(cover), [cover])
  const pattern = useMemo(() => buildPattern(cover), [cover])
  const codeStrip = useMemo(() => buildCodeStrip(cover), [cover])
  const initials = useMemo(() => coverInitials(title), [title])

  const cjk = isCjkText(initials)
  const fontSize = cjk ? 52 : initials.length > 1 ? 46 : 62

  const id = (name: string): string => `${COVER_CLASS}${uid}${name}`
  const ref = (name: string): string => `url(#${id(name)})`

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn(COVER_CLASS, className)}
      style={vars as CSSProperties}
      role="img"
      aria-label={`${title}（自动生成的封面）`}
    >
      <defs>
        <linearGradient id={id('bg')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--fcov-bg-a)" />
          <stop offset="1" stopColor="var(--fcov-bg-b)" />
        </linearGradient>

        <radialGradient id={id('glow')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--fcov-glow)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--fcov-glow)" stopOpacity="0" />
        </radialGradient>

        {/* 玻璃质感：左上高光 + 迅速衰减，模拟一层压在卡带上的亚克力 */}
        <linearGradient id={id('sheen')} x1="0" y1="0" x2="0.55" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={id('plate')} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="var(--fcov-plate-shine)" />
          <stop offset="1" stopColor="var(--fcov-plate-shadow)" />
        </linearGradient>

        <radialGradient id={id('vignette')} cx="0.5" cy="0.44" r="0.78">
          <stop offset="0.5" stopColor="var(--fcov-vignette)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--fcov-vignette)" stopOpacity="1" />
        </radialGradient>

        <pattern id={id('scan')} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="1" fill="var(--fcov-scan)" />
        </pattern>
      </defs>

      <rect width={VB_W} height={VB_H} fill={ref('bg')} />
      <ellipse
        cx={cover.flip ? VB_W * 0.24 : VB_W * 0.72}
        cy={VB_H * 0.22}
        rx={VB_W * 0.55}
        ry={VB_H * 0.6}
        fill={ref('glow')}
      />

      <g>{pattern}</g>

      {/* 卡带贴纸 */}
      <g>
        <rect
          className={`${COVER_CLASS}-plate`}
          x={42}
          y={34}
          width={156}
          height={112}
          rx={18}
          opacity={0.72}
        />
        <rect x={42} y={34} width={156} height={112} rx={18} fill={ref('plate')} />
        <rect
          className={`${COVER_CLASS}-edge`}
          x={42.75}
          y={34.75}
          width={154.5}
          height={110.5}
          rx={17.25}
          strokeWidth={1.5}
          opacity={0.55}
        />

        {showTitle ? (
          <text
            className={`${COVER_CLASS}-text`}
            x={VB_W / 2}
            y={VB_H / 2 - 2}
            fontSize={fontSize}
            fontWeight={700}
            letterSpacing={cjk ? 2 : 4}
            style={{ fontFamily: cjk ? 'var(--font-pixel-cn)' : 'var(--font-pixel)' }}
          >
            {initials}
          </text>
        ) : (
          // 不叠字时画三道凹槽，小尺寸下依然能读成一盒卡带
          <g opacity={0.5}>
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                className={`${COVER_CLASS}-edge`}
                x={72}
                y={74 + i * 16}
                width={96}
                height={6}
                rx={3}
                strokeWidth={1.5}
              />
            ))}
          </g>
        )}
      </g>

      <g>{codeStrip}</g>

      {/* 卡带底部握把凹槽 */}
      <g opacity={0.45}>
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            className={INK}
            x={VB_W - 62 + i * 16}
            y={VB_H - 22}
            width={10}
            height={10}
            rx={2}
          />
        ))}
      </g>

      <rect width={VB_W} height={VB_H} fill={ref('scan')} opacity={0.22} />
      <rect width={VB_W} height={VB_H} fill={ref('vignette')} />
      <path d={`M0 0 H${VB_W} L0 ${VB_H * 0.86} Z`} fill={ref('sheen')} />
      <rect
        x={0.75}
        y={0.75}
        width={VB_W - 1.5}
        height={VB_H - 1.5}
        rx={6}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.14}
        strokeWidth={1.5}
      />
    </svg>
  )
}

/**
 * 纯展示组件，同样的 props 永远画出同样的东西，
 * 封面墙滚动时不该因为父级重渲染而重算几百张 SVG。
 */
export const GeneratedCover = memo(GeneratedCoverImpl)
