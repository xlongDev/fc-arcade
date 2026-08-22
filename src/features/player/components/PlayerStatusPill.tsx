interface Props {
  fps: number
  showFps: boolean
  /** 内核显示名，如 fceumm；对普通玩家非时刻需要，故渲染成极淡文字 */
  coreName: string
}

/**
 * 顶栏右侧的状态胶囊：把 FPS 与内核名合并成一条极淡的玻璃胶囊，
 * 取代原先两颗高对比 Badge，避免挤占标题区、抢走画面注意力。
 * FPS 关闭时只保留极淡的内核名。
 */
export function PlayerStatusPill({ fps, showFps, coreName }: Props) {
  return (
    <div className="glass flex items-center gap-2 rounded-full px-2.5 py-1 text-muted">
      {showFps ? (
        <span className="flex items-center gap-1.5 text-[11px] font-medium tabular-nums">
          <span className="size-1.5 rounded-full bg-success/80" aria-hidden />
          {fps.toFixed(0)} FPS
        </span>
      ) : null}
      {showFps && coreName ? <span className="h-3 w-px bg-border" aria-hidden /> : null}
      {coreName ? <span className="text-[11px] text-faint">{coreName}</span> : null}
    </div>
  )
}
