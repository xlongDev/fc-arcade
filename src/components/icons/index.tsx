/**
 * FC Arcade 图标集
 * ------------------------------------------------------------------
 * 全部手绘，走像素网格审美：坐标尽量落在 24×24 的整数（少量 0.5）网格点上，
 * 折线优先直角，端点用 square / 折角用 miter —— 这是刻意的，round 会把
 * 8bit 的硬边磨圆，跟整站的像素调性打架。
 *
 * 颜色一律 currentColor，由外层 text-* 决定；尺寸走 size prop（默认 20）。
 * 默认 aria-hidden，图标是装饰性的；需要语义时外层自己给 aria-label。
 */
import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & {
  /** 同时作用于 width / height，单位 px。默认 20 */
  size?: number
}

/**
 * 所有图标共用的 <svg> 外壳。
 * 属性顺序很重要：默认值写在 {...rest} 前面，调用方才能覆盖
 * （比如给 IconPlay 传 strokeWidth={1.5}，或把 aria-hidden 关掉）。
 */
function Svg({ size = 20, children, ...rest }: IconProps & { children?: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* 状态 / 提示                                                          */
/* ------------------------------------------------------------------ */

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </Svg>
  )
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 3h6l6 6v6l-6 6H9l-6-6V9l6-6Z" />
      <path d="M12 11v6" />
      <path d="M12 7h.01" />
    </Svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12 9 17 20 6" />
    </Svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5 19 19" />
      <path d="M19 5 5 19" />
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* 收藏                                                                 */
/* ------------------------------------------------------------------ */

/** 像素五角星：顶点全部落在整数格 */
const STAR_PATH = 'M12 3 14 9 21 9 16 13 18 20 12 16 6 20 8 13 3 9 10 9Z'

export function IconStar(props: IconProps) {
  return (
    <Svg {...props}>
      <path d={STAR_PATH} />
    </Svg>
  )
}

export function IconStarFilled(props: IconProps) {
  return (
    <Svg {...props}>
      <path d={STAR_PATH} fill="currentColor" />
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* 门面图标：卡带 / 芯片 / 手柄                                          */
/* ------------------------------------------------------------------ */

/** FC 卡带：上宽下收的塑料壳 + 贴纸窗口 + 两道防滑筋 */
export function IconCartridge(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 2h16v15l-3 5H7l-3-5V2Z" />
      <path d="M7 5h10v6H7V5Z" />
      <path d="M9 14h6" />
      <path d="M9 17h6" />
    </Svg>
  )
}

/** DIP 封装芯片：方壳 + 硅片 + 八根引脚 */
export function IconChip(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6h12v12H6V6Z" />
      <path d="M10 10h4v4h-4v-4Z" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </Svg>
  )
}

/** 红白机手柄：横长条 + 十字键 + Select/Start + A/B */
export function IconGamepad(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 7h20v10H2V7Z" />
      <path d="M6 10v4" />
      <path d="M4 12h4" />
      <path d="M10 14h4" />
      <path d="M14 11h2v2h-2v-2Z" />
      <path d="M18 11h2v2h-2v-2Z" />
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* 播放控制                                                             */
/* ------------------------------------------------------------------ */

export function IconPlay(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4 20 12 8 20Z" />
    </Svg>
  )
}

export function IconPause(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 5h3v14H8V5Z" />
      <path d="M13 5h3v14h-3V5Z" />
    </Svg>
  )
}

export function IconVolume(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9h4l5-4v14l-5-4H4V9Z" />
      <path d="M16 9v6" />
      <path d="M19 7v10" />
    </Svg>
  )
}

export function IconVolumeMute(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9h4l5-4v14l-5-4H4V9Z" />
      <path d="M17 9 22 15" />
      <path d="M22 9 17 15" />
    </Svg>
  )
}

/** IconVolumeMute 的短别名 */
export { IconVolumeMute as IconMute }

export function IconFullscreen(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 9V3h6" />
      <path d="M15 3h6v6" />
      <path d="M21 15v6h-6" />
      <path d="M9 21H3v-6" />
    </Svg>
  )
}

export function IconFullscreenExit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 3v6H3" />
      <path d="M15 3v6h6" />
      <path d="M15 21v-6h6" />
      <path d="M9 21v-6H3" />
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* 存档 / 文件                                                          */
/* ------------------------------------------------------------------ */

/** 3.5 寸软盘：写保护滑片 + 贴纸 */
export function IconSave(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4h13l3 3v13H4V4Z" />
      <path d="M8 4h7v6H8V4Z" />
      <path d="M7 14h10v6H7v-6Z" />
    </Svg>
  )
}

/** 软盘 + 向上箭头：从存档读回内存 */
export function IconLoad(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4h13l3 3v13H4V4Z" />
      <path d="M12 18v-7" />
      <path d="M9 14 12 11 15 14" />
    </Svg>
  )
}

export function IconFolder(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 5h7l2 3h9v12H3V5Z" />
    </Svg>
  )
}

export function IconUpload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 16v4h16v-4" />
      <path d="M12 4v11" />
      <path d="M7 9 12 4 17 9" />
    </Svg>
  )
}

export function IconDownload(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 16v4h16v-4" />
      <path d="M12 4v11" />
      <path d="M7 10 12 15 17 10" />
    </Svg>
  )
}

export function IconCamera(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7h4l2-3h6l2 3h4v13H3V7Z" />
      <path d="M9 10h6v6H9v-6Z" />
    </Svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16" />
      <path d="M9 3h6v3H9V3Z" />
      <path d="M6 6v14h12V6" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* 编辑 / 表单                                                          */
/* ------------------------------------------------------------------ */

export function IconEdit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20v-4L16 4l4 4L8 20H4Z" />
      <path d="M14 6 18 10" />
    </Svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  )
}

export function IconMinus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h4l4 4v4l-4 4H8l-4-4V8l4-4Z" />
      <path d="M15 15 21 21" />
    </Svg>
  )
}

export function IconFilter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4h18l-7 8v8l-4-2v-6L3 4Z" />
    </Svg>
  )
}

export function IconSort(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4v16" />
      <path d="M4 17 7 20 10 17" />
      <path d="M17 20V4" />
      <path d="M14 7 17 4 20 7" />
    </Svg>
  )
}

export function IconEye(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 12 7 7h10l5 5-5 5H7l-5-5Z" />
      <path d="M10 10h4v4h-4v-4Z" />
    </Svg>
  )
}

export function IconEyeOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 12 7 7h10l5 5-5 5H7l-5-5Z" />
      <path d="M10 10h4v4h-4v-4Z" />
      <path d="M3 3 21 21" />
    </Svg>
  )
}

/** 六点抓手，用在可拖拽排序的行首 */
export function IconDrag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6h2v2H9V6Z" />
      <path d="M14 6h2v2h-2V6Z" />
      <path d="M9 11h2v2H9v-2Z" />
      <path d="M14 11h2v2h-2v-2Z" />
      <path d="M9 16h2v2H9v-2Z" />
      <path d="M14 16h2v2h-2v-2Z" />
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* 导航 / 布局                                                          */
/* ------------------------------------------------------------------ */

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v11h14V10" />
      <path d="M10 21v-6h4v6" />
    </Svg>
  )
}

/** 阶梯状像素齿轮：八段折角外轮廓 + 方形轴孔 */
export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4h8l4 4v8l-4 4H8l-4-4V8l4-4Z" />
      <path d="M10 10h4v4h-4v-4Z" />
      <path d="M11 2h2v2h-2V2Z" />
      <path d="M11 20h2v2h-2v-2Z" />
      <path d="M2 11h2v2H2v-2Z" />
      <path d="M20 11h2v2h-2v-2Z" />
    </Svg>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 9 12 16 19 9" />
    </Svg>
  )
}

export function IconChevronUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 15 12 8 19 15" />
    </Svg>
  )
}

/** 带横杆的返回箭头，跟只有折角的 IconChevronLeft 区分：这个表示「离开当前页」 */
export function IconArrowLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12H4" />
      <path d="M10 6 4 12 10 18" />
    </Svg>
  )
}

export function IconArrowRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h16" />
      <path d="M14 6 20 12 14 18" />
    </Svg>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 5 8 12 15 19" />
    </Svg>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5 16 12 9 19" />
    </Svg>
  )
}

/** 2×2 大卡片 */
export function IconGrid(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3h8v8H3V3Z" />
      <path d="M13 3h8v8h-8V3Z" />
      <path d="M3 13h8v8H3v-8Z" />
      <path d="M13 13h8v8h-8v-8Z" />
    </Svg>
  )
}

/** 3×2 紧凑网格 */
export function IconCompact(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4h6v7H3V4Z" />
      <path d="M9 4h6v7H9V4Z" />
      <path d="M15 4h6v7h-6V4Z" />
      <path d="M3 13h6v7H3v-7Z" />
      <path d="M9 13h6v7H9v-7Z" />
      <path d="M15 13h6v7h-6v-7Z" />
    </Svg>
  )
}

export function IconList(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h2M4 12h2M4 18h2" />
      <path d="M9 6h11M9 12h11M9 18h11" />
    </Svg>
  )
}

/** 单个勾选框：进入「选择模式」 */
export function IconSelect(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4h16v16H4V4Z" />
      <path d="M8 12 11 15 17 9" />
    </Svg>
  )
}

/** 两个重叠勾选框：选中当前视图全部项目 */
export function IconSelectAll(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3h9v9H3V3Z" />
      <path d="M5 7 7 9 11 5" />
      <path d="M12 12h9v9h-9v-9Z" />
      <path d="M14 16 16 18 20 14" />
    </Svg>
  )
}

/** 封面墙：3×3 密排 */
export function IconWall(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3h18v18H3V3Z" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
    </Svg>
  )
}

/** 卡带架：三盒卡带立在层板上 */
export function IconShelf(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4h4v13H3V4Z" />
      <path d="M9 4h4v13H9V4Z" />
      <path d="M15 4h4v13h-4V4Z" />
      <path d="M2 20h20" />
    </Svg>
  )
}

/* ------------------------------------------------------------------ */
/* 其它                                                                 */
/* ------------------------------------------------------------------ */

export function IconRefresh(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12a8 8 0 1 1-3-6.2" />
      <path d="M20 4v4h-4" />
    </Svg>
  )
}

/** 逆时针方向的循环箭头，跟 IconRefresh 区分开，用在「恢复默认」 */
export function IconReset(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 4v4h4" />
    </Svg>
  )
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 3h6l6 6v6l-6 6H9l-6-6V9l6-6Z" />
      <path d="M12 7v5h4" />
    </Svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14A9 9 0 1 1 10 4a7 7 0 0 0 10 10Z" />
    </Svg>
  )
}

/** 方核太阳 + 八向光芒 */
export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 9h6v6H9V9Z" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <path d="M5 5 7 7M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </Svg>
  )
}

export function IconKeyboard(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 6h20v12H2V6Z" />
      <path d="M5 9h2M9 9h2M13 9h2M17 9h2" />
      <path d="M5 12h2M9 12h2M13 12h2M17 12h2" />
      <path d="M8 15h8" />
    </Svg>
  )
}

export function IconPalette(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 4h18v11l-5 5H3V4Z" />
      <path d="M6 7h3v3H6V7Z" />
      <path d="M12 7h3v3h-3V7Z" />
      <path d="M6 13h3v3H6v-3Z" />
    </Svg>
  )
}
