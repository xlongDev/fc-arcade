import { useCallback, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useNavigate, useParams } from 'react-router'

import { Button, EmptyState, Sheet, Spinner, useToast } from '@/components/ui'
import { IconCartridge } from '@/components/icons'
import { coverDao, gameDao } from '@/data'
import { useGameById } from '@/features/common/hooks/useGameById'
import { useIsCompactViewport, useIsTouchDevice } from '@/features/common/hooks/useMediaQuery'
import { useReduceMotion } from '@/features/common/hooks/useReduceMotion'
import { notifyLibraryChanged, notifyStorageChanged } from '@/features/common/lib/storageEvents'
import { TouchGamepad } from '@/input'
import { useSettingsStore } from '@/store'
import type { EmulatorAdapter } from '@/types/emulator'
import { NES_HEIGHT, NES_WIDTH } from '@/types/emulator'
import type { NesButton } from '@/types/input'
import type { SaveSlot } from '@/types/storage'

import { EmulatorScreen } from './components/EmulatorScreen'
import { PlayerControlBar } from './components/PlayerControlBar'
import { PlayerStatusOverlay } from './components/PlayerStatusOverlay'
import { PlayerTopBar } from './components/PlayerTopBar'
import { SaveSlotPanel } from './components/SaveSlotPanel'
import { useAutoHideControls } from './useAutoHideControls'
import { useEmulatorSession } from './useEmulatorSession'
import { useFullscreen } from './useFullscreen'
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

  const [touchVisible, setTouchVisible] = useState(isTouch)
  const [savesOpen, setSavesOpen] = useState(false)

  const inputRef = usePlayerInput(touchVisible)
  const onPlaytime = usePlaytimeTracker({ game, adapterRef })
  const session = useEmulatorSession({ game, inputRef, adapterRef, onPlaytime })
  const saves = useSaveSlots({ gameId, adapterRef })
  const fullscreen = useFullscreen(shellRef)

  const busy = session.status === 'loading' || session.status === 'idle'
  const keepControls = !session.running || savesOpen || session.error !== null
  const controls = useAutoHideControls(keepControls)

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
        width: NES_WIDTH * SCREENSHOT_SCALE,
        height: NES_HEIGHT * SCREENSHOT_SCALE,
        updatedAt: Date.now(),
      })
      await gameDao.update(game.id, { coverKind: 'screenshot' })
      notifyLibraryChanged()
      notifyStorageChanged()
      toast({ variant: 'success', title: '截图已设为封面' })
    } catch (cause) {
      console.error('[fc-arcade] 截图失败', cause)
      toast({ variant: 'error', title: '截图失败' })
    }
  }, [game, toast])

  const openSaves = useCallback(() => {
    if (compact) setSavesOpen(true)
  }, [compact])

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
      className="fixed inset-0 z-40 flex flex-col bg-black"
      onPointerMove={controls.ping}
    >
      <div className="relative flex-1 overflow-hidden">
        <EmulatorScreen
          canvasRef={session.canvasRef}
          filter={settings.screenFilter}
          integerScale={settings.integerScale}
          dimmed={!session.running && session.error === null && !busy}
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
              core={game.preferredCore ?? settings.defaultCore}
              fullscreen={fullscreen.active}
              fullscreenSupported={fullscreen.supported}
              reduceMotion={reduceMotion}
              onExit={exit}
              onToggleFullscreen={fullscreen.toggle}
            />
          ) : null}

          {controls.visible ? (
            <PlayerControlBar
              key="bottom"
              running={session.running}
              muted={settings.muted}
              volume={settings.volume}
              touchVisible={touchVisible}
              showTouchToggle={isTouch}
              reduceMotion={reduceMotion}
              savePanel={compact ? null : savePanel}
              onTogglePause={session.togglePause}
              onReset={session.reset}
              onToggleMute={() => setSetting('muted', !settings.muted)}
              onVolumeChange={(value: number) => {
                setSetting('volume', value)
                if (settings.muted && value > 0) setSetting('muted', false)
              }}
              onScreenshot={() => void captureCover()}
              onToggleTouch={() => setTouchVisible((v) => !v)}
              onOpenSaves={openSaves}
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
            className="pointer-events-none absolute inset-0 z-10 [&_*]:pointer-events-auto"
          />
        ) : null}
      </div>

      <Sheet open={savesOpen} onClose={() => setSavesOpen(false)} title="存档 / 读档">
        {savePanel}
      </Sheet>
    </div>
  )
}
