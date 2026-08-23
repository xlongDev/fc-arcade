import { useCallback, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useNavigate, useParams } from 'react-router'

import { Button, EmptyState, Sheet, Spinner, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { IconCartridge } from '@/components/icons'
import { invalidateCover } from '@/cover'
import { coverDao, gameDao } from '@/data'
import { useGameById } from '@/features/common/hooks/useGameById'
import { useIsCompactViewport, useIsTouchDevice } from '@/features/common/hooks/useMediaQuery'
import { useReduceMotion } from '@/features/common/hooks/useReduceMotion'
import { notifyStorageChanged } from '@/features/common/lib/storageEvents'
import { TouchGamepad } from '@/input'
import { useSettingsStore } from '@/store'
import type { EmulatorAdapter } from '@/types/emulator'
import { NES_VISIBLE_HEIGHT, NES_VISIBLE_WIDTH } from '@/types/emulator'
import { DEFAULT_TOUCH_LAYOUT } from '@/config/defaults'
import type { KeyboardMap, NesButton } from '@/types/input'
import type { SaveSlot } from '@/types/storage'

import { EmulatorScreen } from './components/EmulatorScreen'
import { PlayerControlBar } from './components/PlayerControlBar'
import { PlayerStatusOverlay } from './components/PlayerStatusOverlay'
import { KeyboardMappingPanel } from './components/KeyboardMappingPanel'
import { PlayerTopBar } from './components/PlayerTopBar'
import { SaveSlotPanel } from './components/SaveSlotPanel'
import { useAutoHideControls } from './useAutoHideControls'
import { useEmulatorSession } from './useEmulatorSession'
import { useFullscreen } from './useFullscreen'
import { useHideCursor } from './useHideCursor'
import { usePlayerHotkeys } from './usePlayerHotkeys'
import { usePlayerInput } from './usePlayerInput'
import { usePlaytimeTracker } from './usePlaytimeTracker'
import { useSaveSlots } from './useSaveSlots'

const SCREENSHOT_SCALE = 2

export function PlayerPage() {
  const params = useParams()
  const gameId = params.gameId ?? null
  const navigate = useNavigate()
  const { toast } = useToast()

  const { game, loading: loadingGame, missing } = useGameById(gameId)

  const settings = useSettingsStore((s) => s.settings)
  const setSetting = useSettingsStore((s) => s.setSetting)
  const reduceMotion = useReduceMotion()
  const isTouch = useIsTouchDevice()
  const compact = useIsCompactViewport()

  const shellRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<EmulatorAdapter | null>(null)
  const controlBarRef = useRef<HTMLDivElement>(null)
  const controlBarRO = useRef<ResizeObserver | null>(null)
  const [controlBarHeight, setControlBarHeight] = useState(0)

  const [touchVisible, setTouchVisible] = useState(isTouch)
  // 触屏手柄「布局编辑」模式：开启后各部件可拖拽重排
  const [layoutEdit, setLayoutEdit] = useState(false)
  // 桌面端（Popover 浮层）与移动端（Sheet 全屏）是两条互不相关的路径，
  // 不能共用一个状态 —— 否则桌面端打开 Popover 时 Sheet 也会跟着打开，
  // 出现两个存档面板并列渲染的 bug
  const [savesPopoverOpen, setSavesPopoverOpen] = useState(false)
  const [savesSheetOpen, setSavesSheetOpen] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  const inputRef = usePlayerInput(touchVisible)
  const onPlaytime = usePlaytimeTracker({ game, adapterRef })
  const session = useEmulatorSession({ game, inputRef, adapterRef, onPlaytime })
  const saves = useSaveSlots({ gameId, adapterRef })
  const fullscreen = useFullscreen(shellRef)

  const busy = session.status === 'loading' || session.status === 'idle'
  // 暂停 / 出错 / 面板展开 / 虚拟手柄可见 时强制常显；
  // 虚拟手柄可见意味着用户在用触屏操作，藏起控制栏只会让 mute/全屏够不着。
  // 非全屏时也强制常显：用户在浏览器里看着页面，需要能随时点暂停/截图/全屏，
  // 自动淡出只会让他们找不到按钮；只有进入沉浸式全屏才让控制栏让位给游戏画面。
  const keepControls =
    !session.running ||
    savesPopoverOpen ||
    savesSheetOpen ||
    keyboardOpen ||
    session.error !== null ||
    touchVisible ||
    !fullscreen.active
  const controls = useAutoHideControls(keepControls)

  // 控制栏经由 Framer Motion 的 motion.div 渲染，其 ref 会在首次 passive effect 时尚未挂载
  // （Framer 在 commit 之后才把 DOM 节点交给 ref），导致用 useEffect 测量时 ref 恒为 null、
  // 手柄偏移一直走 112px 兜底值。改用回调 ref：节点在 commit 阶段一挂载 React 就回调，
  // 此时读取 offsetHeight 会强制同步布局，能拿到真实高度，并接管 ResizeObserver。
  const handleControlBarRef = useCallback((node: HTMLDivElement | null) => {
    controlBarRef.current = node
    controlBarRO.current?.disconnect()
    controlBarRO.current = null
    if (!node) return
    const measure = () => {
      const computed = getComputedStyle(node)
      const bottomPadding = parseFloat(computed.paddingBottom) || 0
      setControlBarHeight(Math.max(0, node.offsetHeight - bottomPadding))
    }
    measure()
    controlBarRO.current = new ResizeObserver(measure)
    controlBarRO.current.observe(node)
  }, [])

  const hideCursor = useHideCursor(session.running && !controls.visible && !savesPopoverOpen && !savesSheetOpen)

  const exit = useCallback(() => void navigate('/'), [navigate])

  const captureCover = useCallback(async () => {
    const adapter = adapterRef.current
    if (!adapter || !game) return
    try {
      const blob = await adapter.screenshot({ scale: SCREENSHOT_SCALE, type: 'image/webp' })
      await coverDao.put({
        gameId: game.id,
        kind: 'screenshot',
        blob,
        width: NES_VISIBLE_WIDTH * SCREENSHOT_SCALE,
        height: NES_VISIBLE_HEIGHT * SCREENSHOT_SCALE,
        updatedAt: Date.now(),
      })
      await gameDao.update(game.id, { coverKind: 'screenshot' })
      // 让封面缓存失效：库里的封面组件订阅了 cover 版本，失效后会重新取用新截图。
      // 否则缓存命中时 acquireCover 直接返回旧 objectURL，截图写进了库但封面仍显示旧图。
      invalidateCover(game.id)
      // 播放器内不挂载游戏库，无需广播 libraryChanged 让 useGameById 重拉（否则 loading 闪烁会
      // 把播放器卸载成 Spinner 再重挂，导致 canvas 节点替换、模拟器重启）。退出后会由库自身刷新。
      notifyStorageChanged()
      toast({ variant: 'success', title: '截图已设为封面' })
    } catch (cause) {
      console.error('[fc-arcade] 截图失败', cause)
      toast({ variant: 'error', title: '截图失败' })
    }
  }, [game, toast])

  const openSaves = useCallback(() => {
    if (compact) setSavesSheetOpen(true)
  }, [compact])

  const handleKeyboardChange = useCallback(
    (next: KeyboardMap) => {
      setSetting('keyboardMap', next)
      // 立刻同步给当前游戏的 InputManager，否则要退出再进才生效
      inputRef.current?.setKeyboardMap(next)
    },
    [setSetting, inputRef],
  )

  usePlayerHotkeys(
    {
      onTogglePause: session.togglePause,
      onReset: session.reset,
      onToggleFullscreen: fullscreen.toggle,
      onToggleMute: () => setSetting('muted', !settings.muted),
      onExit: exit,
      onSaveSlot: (slot: SaveSlot) => void saves.save(slot),
      onLoadSlot: (slot: SaveSlot) => void saves.load(slot),
    },
    game !== null,
  )

  if (loadingGame) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (missing || !game) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <EmptyState
          icon={<IconCartridge size={30} />}
          title="找不到这个游戏"
          description="它可能已经被删除了，或者链接失效。"
          action={
            <Button variant="primary" onClick={exit}>
              回到游戏库
            </Button>
          }
        />
      </div>
    )
  }

  const savePanel = (
    <SaveSlotPanel
      rows={saves.rows}
      busySlot={saves.busySlot}
      onSave={(slot) => void saves.save(slot)}
      onLoad={(slot) => void saves.load(slot)}
      onRemove={(slot) => void saves.remove(slot)}
    />
  )

  return (
    <div
      ref={shellRef}
      className={cn(
        'fixed inset-0 z-40 flex flex-col bg-bg',
        hideCursor && 'cursor-none',
      )}
      onPointerMove={controls.ping}
    >
      <div className="relative flex-1 overflow-hidden">
        <EmulatorScreen
          canvasRef={session.canvasRef}
          filter={settings.screenFilter}
          integerScale={settings.integerScale}
          aspectRatio={settings.aspectRatio}
          dimmed={!session.running && session.error === null && !busy}
          fullscreen={fullscreen.active}
          onActivate={() => {
            controls.ping()
            if (session.audioBlocked) void session.unlockAudio()
          }}
        />

        <PlayerStatusOverlay
          loading={busy}
          paused={session.status === 'paused'}
          audioBlocked={session.audioBlocked}
          error={session.error}
          onResume={session.resume}
          onRetry={session.retry}
          onUnlockAudio={() => void session.unlockAudio()}
          onExit={exit}
        />

        <AnimatePresence initial={false}>
          {controls.visible ? (
            <PlayerTopBar
              key="top"
              game={game}
              fps={session.stats.fps}
              showFps={settings.showFps}
              core={session.activeCore ?? game.preferredCore ?? settings.defaultCore}
              reduceMotion={reduceMotion}
              onExit={exit}
            />
          ) : null}

          {controls.visible ? (
            <PlayerControlBar
              ref={handleControlBarRef}
              key="bottom"
              running={session.running}
              muted={settings.muted}
              volume={settings.volume}
              touchVisible={touchVisible}
              showTouchToggle={isTouch}
              fullscreen={fullscreen.active}
              fullscreenSupported={fullscreen.supported}
              reduceMotion={reduceMotion}
              savePanel={compact ? null : savePanel}
              savesOpen={savesPopoverOpen}
              onSavesOpenChange={setSavesPopoverOpen}
              onTogglePause={session.togglePause}
              onReset={session.reset}
              onToggleMute={() => setSetting('muted', !settings.muted)}
              onVolumeChange={(value: number) => {
                setSetting('volume', value)
                if (settings.muted && value > 0) setSetting('muted', false)
              }}
              onScreenshot={() => void captureCover()}
              onToggleTouch={() => {
                setTouchVisible((v) => {
                  if (v) setLayoutEdit(false)
                  return !v
                })
              }}
              onOpenSaves={openSaves}
              onOpenKeyboard={() => setKeyboardOpen(true)}
              onToggleFullscreen={fullscreen.toggle}
              layoutEdit={layoutEdit}
              onToggleLayoutEdit={() => setLayoutEdit((v) => !v)}
              onResetLayout={() => setSetting('touchLayout', null)}
            />
          ) : null}
        </AnimatePresence>

        {isTouch && touchVisible ? (
          <TouchGamepad
            onButtonChange={(button: NesButton, pressed: boolean) => {
              inputRef.current?.setTouchButton(0, button, pressed)
            }}
            opacity={settings.touchOpacity}
            scale={settings.touchScale}
            vibration={settings.vibration}
            controlBarOffset={`${controlBarHeight || 112}px`}
            editMode={layoutEdit}
            layout={settings.touchLayout}
            onLayoutChange={(id, pos) =>
              setSetting('touchLayout', { ...(settings.touchLayout ?? DEFAULT_TOUCH_LAYOUT), [id]: pos })
            }
            className="pointer-events-none absolute inset-0 z-10"
          />
        ) : null}
      </div>

      <Sheet open={savesSheetOpen} onClose={() => setSavesSheetOpen(false)} title="存档 / 读档">
        {savePanel}
      </Sheet>

      <Sheet
        open={keyboardOpen}
        onClose={() => setKeyboardOpen(false)}
        title="键位设置"
        description="点击按键后按下要绑定的物理键"
      >
        <KeyboardMappingPanel
          keyboardMap={settings.keyboardMap}
          onChange={handleKeyboardChange}
        />
      </Sheet>
    </div>
  )
}
