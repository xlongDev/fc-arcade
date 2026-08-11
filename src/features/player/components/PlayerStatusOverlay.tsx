import { AnimatePresence, motion } from 'motion/react'

import { Button, Spinner } from '@/components/ui'
import { IconAlert, IconPlay, IconVolume } from '@/components/icons'
import { overlayVariants } from '@/features/common/motion'
import type { EmulatorError, EmulatorErrorCode } from '@/types/emulator'

/** 把内核错误码翻译成人能看懂的说明 + 该怎么办 */
const ERROR_HINT: Readonly<Record<EmulatorErrorCode, string>> = {
  'invalid-rom': '这个文件不是有效的 NES ROM，或者数据已经损坏了。建议删除后重新导入。',
  'unsupported-mapper': '这个卡带用的 Mapper 芯片当前内核还不支持。可以到设置里换成 RetroArch 内核再试。',
  'core-load-failed': '模拟器内核没能加载。RetroArch 内核需要联网下载，检查一下网络再重试。',
  'audio-blocked': '浏览器拦下了自动播放的声音，点一下画面就能恢复。',
  'save-state-failed': '保存进度失败，可能是浏览器存储空间不够了。',
  'load-state-failed': '这份存档读不出来，可能已经损坏或者不是当前内核保存的。',
  'core-mismatch': '存档来自另一个模拟器内核，换回原内核才能继续。',
  runtime: '模拟器运行时出错了。重试一次通常能恢复，反复出现的话换个内核试试。',
}

interface Props {
  loading: boolean
  paused: boolean
  audioBlocked: boolean
  error: EmulatorError | null
  onResume: () => void
  onRetry: () => void
  onUnlockAudio: () => void
  onExit: () => void
}

/** 加载 / 暂停 / 出错 / 音频被拦四种状态的全屏遮罩，同一时刻只显示优先级最高的一个。 */
export function PlayerStatusOverlay({
  loading,
  paused,
  audioBlocked,
  error,
  onResume,
  onRetry,
  onUnlockAudio,
  onExit,
}: Props) {
  const layer = error ? 'error' : loading ? 'loading' : audioBlocked ? 'audio' : paused ? 'paused' : null

  return (
    <AnimatePresence mode="wait">
      {layer === null ? null : (
        <motion.div
          key={layer}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
        >
          {layer === 'loading' ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="font-pixel text-[11px] tracking-wide text-white/70">正在装载卡带…</p>
            </div>
          ) : layer === 'error' && error ? (
            <div className="flex max-w-sm flex-col items-center gap-4 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-[var(--color-danger)]/20 text-[var(--color-danger)]">
                <IconAlert size={26} />
              </span>
              <div>
                <p className="text-base font-medium text-white">游戏跑不起来</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">
                  {ERROR_HINT[error.code]}
                </p>
                <p className="mt-2 font-pixel text-[10px] text-white/35">{error.message}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onExit}>
                  返回游戏库
                </Button>
                <Button variant="primary" onClick={onRetry}>
                  重试
                </Button>
              </div>
            </div>
          ) : layer === 'audio' ? (
            <button
              type="button"
              onClick={onUnlockAudio}
              className="flex flex-col items-center gap-3 rounded-3xl px-8 py-6 text-white/80 transition-colors hover:text-white"
            >
              <span className="flex size-14 items-center justify-center rounded-full border border-white/25 bg-white/10">
                <IconVolume size={24} />
              </span>
              <span className="text-sm">点一下开启声音</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onResume}
              className="flex flex-col items-center gap-3 text-white/80 transition-colors hover:text-white"
            >
              <span className="flex size-16 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur">
                <IconPlay size={28} />
              </span>
              <span className="font-pixel text-[11px] tracking-wide">已暂停</span>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
