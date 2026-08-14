/**
 * 设置页。
 *
 * 五个分区（外观 / 音频 / 画面 / 控制 / 键盘）用 Tabs 切换。
 * 主题与明暗模式走 useTheme().setTheme / setMode —— 这两个写入会触发 <ThemeProvider>
 * 的视图过渡动画并广播 fc-arcade:theme 事件，settingsStore 订阅后回写；
 * 直接 setSetting('themeId', ...) 会绕开过渡动画，且与事件回写打架，不要用。
 * 其余设置项一律走 useSettingsStore().setSetting。
 */
import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import {
  Button,
  Card,
  Dialog,
  NumberInput,
  Segmented,
  Select,
  Slider,
  Switch,
  Tabs,
  useToast,
} from '@/components/ui'
import {
  IconChip,
  IconDownload,
  IconGamepad,
  IconKeyboard,
  IconPalette,
  IconReset,
  IconTrash,
  IconUpload,
  IconVolume,
} from '@/components/icons'
import { THEME_LIST, useTheme } from '@/theme'
import { useSettingsStore } from '@/store'
import { DEFAULT_INPUT_MAPS } from '@/store'
import { BUTTON_LABEL, NES_BUTTONS } from '@/types/input'
import type { NesButton, TurboConfig } from '@/types/input'
import { LAYOUT_LABEL, LIBRARY_LAYOUTS, SORT_LABEL } from '@/types/ui'
import type { LibraryLayout, ScreenFilter } from '@/types/ui'
import type { GameSortKey } from '@/types/storage'
import type { EmulatorCore } from '@/types/emulator'
import { ConfirmDialog } from '@/features/common/components/ConfirmDialog'
import { KeyboardMappingPanel } from '@/features/player/components/KeyboardMappingPanel'
import {
  BackupError,
  clearAllData,
  coverDao,
  crcLearnDao,
  db,
  downloadBackup,
  gameDao,
  importBackup,
  previewBackup,
  romDao,
  saveStateDao,
  sessionDao,
  type BackupPreview,
  type BackupProgress,
  type RestoreProgress,
} from '@/data'
import { notifyLibraryChanged, notifyStorageChanged } from '@/features/common/lib/storageEvents'

/* ------------------------------- 通用小组件 ------------------------------- */

function Row({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm text-text">{label}</div>
        {description ? <div className="text-xs text-faint">{description}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card title={title} description={description}>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  )
}

/* --------------------------------- 外观 --------------------------------- */

function AppearanceSection() {
  const { themeId, modeSetting, setTheme, setMode } = useTheme()
  const layout = useSettingsStore((s) => s.settings.layout)
  const sortBy = useSettingsStore((s) => s.settings.sortBy)
  const sortDir = useSettingsStore((s) => s.settings.sortDir)
  const reduceMotion = useSettingsStore((s) => s.settings.reduceMotion)
  const setSetting = useSettingsStore((s) => s.setSetting)

  return (
    <Section title="外观" description="主题、明暗与游戏库默认排布">
      <div>
        <div className="mb-2 text-sm text-text">主题</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEME_LIST.map((theme) => {
            const active = theme.id === themeId
            return (
              <button
                key={theme.id}
                type="button"
                onClick={(event) => setTheme(theme.id, { x: event.clientX, y: event.clientY })}
                className={[
                  'focus-ring group flex flex-col gap-1.5 rounded-xl border p-2.5 text-left transition-colors duration-200',
                  active
                    ? 'border-accent bg-accent-soft'
                    : 'border-border bg-surface hover:border-accent-line',
                ].join(' ')}
              >
                <span className="flex h-7 overflow-hidden rounded-md">
                  {theme.swatch.map((color, i) => (
                    <span key={i} className="flex-1" style={{ background: color }} />
                  ))}
                </span>
                <span className="truncate text-xs text-text">{theme.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <Row label="明暗模式">
        <Segmented
          value={modeSetting}
          onChange={(next) => setMode(next as 'light' | 'dark' | 'system')}
          options={[
            { value: 'light', label: '浅色' },
            { value: 'dark', label: '深色' },
            { value: 'system', label: '跟随系统' },
          ]}
        />
      </Row>

      <Row label="默认布局" description="打开游戏库时使用的视图">
        <Segmented
          value={layout}
          onChange={(next) => setSetting('layout', next as LibraryLayout)}
          options={LIBRARY_LAYOUTS.map((value) => ({ value, label: LAYOUT_LABEL[value] }))}
        />
      </Row>

      <Row label="默认排序">
        <Select<GameSortKey>
          value={sortBy}
          onChange={(next) => setSetting('sortBy', next)}
          options={(
            Object.keys(SORT_LABEL) as GameSortKey[]
          ).map((value) => ({ value, label: SORT_LABEL[value] }))}
        />
      </Row>

      <Row label="排序方向">
        <Segmented
          value={sortDir}
          onChange={(next) => setSetting('sortDir', next as 'asc' | 'desc')}
          options={[
            { value: 'desc', label: '降序' },
            { value: 'asc', label: '升序' },
          ]}
        />
      </Row>

      <Row label="减弱动效" description="关闭过渡与装饰动画">
        <Switch
          checked={reduceMotion}
          onChange={(checked) => setSetting('reduceMotion', checked)}
        />
      </Row>
    </Section>
  )
}

/* --------------------------------- 音频 --------------------------------- */

function AudioSection() {
  const volume = useSettingsStore((s) => s.settings.volume)
  const muted = useSettingsStore((s) => s.settings.muted)
  const defaultCore = useSettingsStore((s) => s.settings.defaultCore)
  const setSetting = useSettingsStore((s) => s.setSetting)

  return (
    <Section title="音频" description="默认音量、静音与模拟内核">
      <Row label="音量">
        <div className="w-44">
          <Slider
            value={Math.round(volume * 100)}
            min={0}
            max={100}
            onChange={(next) => setSetting('volume', next / 100)}
            formatValue={(v) => `${v}%`}
          />
        </div>
      </Row>

      <Row label="静音">
        <Switch checked={muted} onChange={(checked) => setSetting('muted', checked)} />
      </Row>

      <Row label="默认内核" description="fceumm（RetroArch / nostalgist WASM，已本地化离线可用）">
        <Select
          value={defaultCore}
          onChange={(next) => setSetting('defaultCore', next as EmulatorCore)}
          options={[{ value: 'nostalgist', label: 'fceumm' }]}
        />
      </Row>
    </Section>
  )
}

/* --------------------------------- 画面 --------------------------------- */

function ScreenSection() {
  const screenFilter = useSettingsStore((s) => s.settings.screenFilter)
  const integerScale = useSettingsStore((s) => s.settings.integerScale)
  const showFps = useSettingsStore((s) => s.settings.showFps)
  const autoScreenshotAfterSec = useSettingsStore((s) => s.settings.autoScreenshotAfterSec)
  const autoSaveIntervalSec = useSettingsStore((s) => s.settings.autoSaveIntervalSec)
  const setSetting = useSettingsStore((s) => s.setSetting)

  const filterLabels: Record<ScreenFilter, string> = {
    none: '无',
    scanline: '扫描线',
    crt: 'CRT',
    lcd: 'LCD',
  }

  return (
    <Section title="画面与存档" description="屏幕滤镜、像素缩放与自动存档">
      <Row label="屏幕滤镜">
        <Segmented
          value={screenFilter}
          onChange={(next) => setSetting('screenFilter', next as ScreenFilter)}
          options={(['none', 'scanline', 'crt', 'lcd'] as ScreenFilter[]).map((value) => ({
            value,
            label: filterLabels[value],
          }))}
        />
      </Row>

      <Row label="整数倍缩放" description="保持像素锐利，避免画面被拉伸糊掉">
        <Switch checked={integerScale} onChange={(checked) => setSetting('integerScale', checked)} />
      </Row>

      <Row label="显示帧率">
        <Switch checked={showFps} onChange={(checked) => setSetting('showFps', checked)} />
      </Row>

      <Row label="自动截图封面" description="运行满 N 秒后自动截一张当封面，0 = 关闭">
        <div className="w-32">
          <NumberInput
            value={autoScreenshotAfterSec}
            min={0}
            max={600}
            step={5}
            unit="秒"
            aria-label="自动截图间隔秒数"
            onChange={(next) => setSetting('autoScreenshotAfterSec', next)}
          />
        </div>
      </Row>

      <Row label="自动存档间隔" description="每隔 N 秒静默存一次进度，0 = 关闭">
        <div className="w-32">
          <NumberInput
            value={autoSaveIntervalSec}
            min={0}
            max={3600}
            step={10}
            unit="秒"
            aria-label="自动存档间隔秒数"
            onChange={(next) => setSetting('autoSaveIntervalSec', next)}
          />
        </div>
      </Row>
    </Section>
  )
}

/* --------------------------------- 控制 --------------------------------- */

function ControlsSection() {
  const turbo = useSettingsStore((s) => s.settings.turbo)
  const vibration = useSettingsStore((s) => s.settings.vibration)
  const touchOpacity = useSettingsStore((s) => s.settings.touchOpacity)
  const touchScale = useSettingsStore((s) => s.settings.touchScale)
  const setSetting = useSettingsStore((s) => s.setSetting)

  const updateTurbo = (patch: Partial<TurboConfig>) =>
    setSetting('turbo', { ...turbo, ...patch })

  const toggleTurboButton = (button: NesButton) => {
    const has = turbo.buttons.includes(button)
    const buttons = has
      ? turbo.buttons.filter((item) => item !== button)
      : [...turbo.buttons, button]
    updateTurbo({ buttons })
  }

  return (
    <Section title="控制器" description="连发、手柄震动与虚拟手柄">
      <Row label="启用连发" description="对选中的按键按固定频率自动连点">
        <Switch
          checked={turbo.enabled}
          onChange={(checked) => updateTurbo({ enabled: checked })}
        />
      </Row>

      <Row label="连发频率" description="每秒触发次数（2~30）">
        <div className="w-44">
          <Slider
            value={turbo.rateHz}
            min={2}
            max={30}
            onChange={(next) => updateTurbo({ rateHz: next })}
            formatValue={(v) => `${v}Hz`}
          />
        </div>
      </Row>

      <div>
        <div className="mb-2 text-sm text-text">连发按键</div>
        <div className="flex flex-wrap gap-2">
          {NES_BUTTONS.map((button) => {
            const active = turbo.buttons.includes(button)
            return (
              <button
                key={button}
                type="button"
                onClick={() => toggleTurboButton(button)}
                className={[
                  'focus-ring rounded-lg border px-3 py-1.5 text-xs transition-colors duration-200',
                  active
                    ? 'border-transparent bg-accent text-on-accent'
                    : 'border-border bg-surface text-muted hover:border-accent-line hover:text-text',
                ].join(' ')}
              >
                {BUTTON_LABEL[button]}
              </button>
            )
          })}
        </div>
      </div>

      <Row label="手柄震动" description="兼容的手柄在受击时震动（移动端为触感反馈）">
        <Switch checked={vibration} onChange={(checked) => setSetting('vibration', checked)} />
      </Row>

      <Row label="虚拟手柄不透明度">
        <div className="w-44">
          <Slider
            value={Math.round(touchOpacity * 100)}
            min={20}
            max={100}
            onChange={(next) => setSetting('touchOpacity', next / 100)}
            formatValue={(v) => `${v}%`}
          />
        </div>
      </Row>

      <Row label="虚拟手柄尺寸">
        <div className="w-44">
          <Slider
            value={Math.round(touchScale * 100)}
            min={70}
            max={140}
            onChange={(next) => setSetting('touchScale', next / 100)}
            formatValue={(v) => `${v}%`}
          />
        </div>
      </Row>
    </Section>
  )
}

/* --------------------------------- 键盘 --------------------------------- */

function KeyboardSection() {
  const keyboardMap = useSettingsStore((s) => s.settings.keyboardMap)
  const setSetting = useSettingsStore((s) => s.setSetting)

  return (
    <Section
      title="键盘映射"
      description="点击按键后按下要绑定的物理键。同一物理键被多个动作占用时会高亮提醒。"
    >
      <KeyboardMappingPanel
        keyboardMap={keyboardMap}
        onChange={(next) => setSetting('keyboardMap', next)}
        showReset
        onReset={() => setSetting('keyboardMap', DEFAULT_INPUT_MAPS.keyboardMap)}
      />
    </Section>
  )
}

/* ------------------------------- 数据备份 ------------------------------- */

// 设置走 zustand persist，写回 localStorage 后需主动 rehydrate 让 store 生效
function rehydrateSettings(): void {
  const api = useSettingsStore as unknown as {
    persist?: { rehydrate?: () => Promise<unknown> | void }
  }
  api.persist?.rehydrate?.()
}

function PreviewStat({ label, value }: { label: string; value: number | boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="text-lg font-medium text-text">
        {typeof value === 'number' ? value : value ? '是' : '否'}
      </div>
      <div className="text-xs text-faint">{label}</div>
    </div>
  )
}

function DataSection() {
  const { toast } = useToast()
  const autoBackupEnabled = useSettingsStore((s) => s.settings.autoBackupEnabled)
  const autoBackupIntervalHrs = useSettingsStore((s) => s.settings.autoBackupIntervalHrs)
  const autoBackupOnExit = useSettingsStore((s) => s.settings.autoBackupOnExit)
  const setSetting = useSettingsStore((s) => s.setSetting)

  const [mode, setMode] = useState<'export' | 'import' | null>(null)
  const [progress, setProgress] = useState<BackupProgress | RestoreProgress | null>(null)
  const [replace, setReplace] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [clearing, setClearing] = useState(false)
  const [pendingClear, setPendingClear] = useState<'saves' | 'roms' | 'records' | 'all' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingFile = useRef<File | null>(null)

  const handleExport = async () => {
    setMode('export')
    setProgress(null)
    try {
      await downloadBackup({ onProgress: setProgress })
      toast({
        variant: 'success',
        title: '备份已导出',
        description: 'ROM、存档、封面与设置都已包含在一个 .fcab 文件里。',
      })
    } catch (error) {
      toast({
        variant: 'error',
        title: '导出失败',
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setMode(null)
      setProgress(null)
    }
  }

  const runImport = async (file: File) => {
    setPreviewOpen(false)
    setMode('import')
    setProgress(null)
    try {
      const summary = await importBackup(file, {
        mode: replace ? 'replace' : 'merge',
        onProgress: setProgress,
      })
      notifyLibraryChanged()
      if (summary.settings) rehydrateSettings()
      const detail = `${summary.games} 个游戏 · ${summary.roms} 个 ROM · ${summary.saveStates} 个存档`
      toast({ variant: 'success', title: '恢复完成', description: detail })
      if (summary.errors.length > 0) {
        toast({
          variant: 'warning',
          title: `${summary.errors.length} 项未恢复`,
          description: summary.errors[0],
        })
      }
    } catch (error) {
      const message =
        error instanceof BackupError
          ? error.message
          : error instanceof Error
            ? error.message
            : '恢复失败'
      toast({ variant: 'error', title: '恢复失败', description: message })
    } finally {
      setMode(null)
      setProgress(null)
      pendingFile.current = null
    }
  }

  /** 选中文件后先解析出预览，再让用户确认是否恢复 */
  const requestPreview = async (file: File) => {
    pendingFile.current = file
    setPreviewLoading(true)
    setPreview(null)
    try {
      const result = await previewBackup(file)
      setPreview(result)
      setPreviewOpen(true)
    } catch (error) {
      const message =
        error instanceof BackupError
          ? error.message
          : error instanceof Error
            ? error.message
            : '预览失败'
      toast({ variant: 'error', title: '无法读取备份', description: message })
    } finally {
      setPreviewLoading(false)
    }
  }

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void requestPreview(file)
  }

  const handleClearSaves = async () => {
    setClearing(true)
    try {
      await saveStateDao.clear()
      notifyStorageChanged()
      toast({
        variant: 'success',
        title: '存档已清空',
        description: '全部即时存档与自动存档已删除。',
      })
    } catch (error) {
      toast({
        variant: 'error',
        title: '清空存档失败',
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setClearing(false)
      setPendingClear(null)
    }
  }

  const handleClearRoms = async () => {
    setClearing(true)
    try {
      await romDao.clear()
      notifyLibraryChanged()
      toast({
        variant: 'success',
        title: 'ROM 已清空',
        description: '全部 ROM 二进制已删除，游戏记录仍保留在库中。',
      })
    } catch (error) {
      toast({
        variant: 'error',
        title: '清空 ROM 失败',
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setClearing(false)
      setPendingClear(null)
    }
  }

  const handleClearRecords = async () => {
    setClearing(true)
    try {
      await db.transaction(
        'rw',
        [db.games, db.covers, db.sessions, db.crcLearn],
        async () => {
          await Promise.all([
            gameDao.clear(),
            coverDao.clear(),
            sessionDao.clear(),
            crcLearnDao.clear(),
          ])
        },
      )
      notifyLibraryChanged()
      notifyStorageChanged()
      toast({
        variant: 'success',
        title: '游戏记录已清空',
        description: '全部游戏条目、封面、游玩记录与 CRC 学习记录已删除。ROM 与存档未被删除。',
      })
    } catch (error) {
      toast({
        variant: 'error',
        title: '清空游戏记录失败',
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setClearing(false)
      setPendingClear(null)
    }
  }

  const handleClearAll = async () => {
    setClearing(true)
    try {
      await clearAllData()
      notifyLibraryChanged()
      notifyStorageChanged()
      toast({
        variant: 'success',
        title: '全部数据已清空',
        description: '游戏、ROM、封面、存档、会话等所有本地数据已删除。',
      })
    } catch (error) {
      toast({
        variant: 'error',
        title: '清空全部数据失败',
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setClearing(false)
      setPendingClear(null)
    }
  }

  const progressLabel = progress
    ? `${progress.label}${progress.total > 0 ? `（${Math.round((progress.processed / progress.total) * 100)}%）` : ''}`
    : null

  return (
    <>
      <Section
        title="数据备份"
        description="把游戏、ROM、存档、封面与设置打包成一个文件，便于换设备迁移或留档。"
      >
        <Row label="导出备份" description="包含所有游戏、ROM 二进制、存档、封面与当前设置">
          <Button
            variant="primary"
            icon={<IconDownload size={15} />}
            onClick={() => void handleExport()}
            disabled={mode !== null}
          >
            {mode === 'export' ? '导出中…' : '导出备份'}
          </Button>
        </Row>

        <Row
          label="恢复备份"
          description="选择 .fcab 文件后，会先预览其中包含的内容，再让你确认恢复"
        >
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<IconUpload size={15} />}
              onClick={() => fileRef.current?.click()}
              disabled={mode !== null || previewLoading}
            >
              {mode === 'import' ? '恢复中…' : previewLoading ? '读取中…' : '选择备份文件'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".fcab,application/zip,.zip"
              className="hidden"
              onChange={onPickFile}
            />
          </div>
        </Row>

        {progressLabel ? <div className="text-xs text-muted">{progressLabel}</div> : null}

        <p className="text-xs text-faint">
          备份文件为 <span className="text-muted">.fcab</span>（本质是 zip）。建议在重大改动前后各留一份。
        </p>
      </Section>

      <Section
        title="自动备份"
        description="开启后按设定自动下载备份到「下载」目录，免去手动导出。"
      >
        <Row label="自动备份" description="总开关：定时与退出时两种触发都受它控制">
          <Switch
            checked={autoBackupEnabled}
            onChange={(checked) => setSetting('autoBackupEnabled', checked)}
          />
        </Row>

        <Row
          label="定时备份间隔"
          description="每 N 小时下载一份；0 = 只做「退出时」备份，不定点定时"
        >
          <div className="w-32">
            <NumberInput
              value={autoBackupIntervalHrs}
              min={0}
              max={720}
              step={1}
              unit="小时"
              aria-label="定时备份间隔小时数"
              onChange={(next) => setSetting('autoBackupIntervalHrs', next)}
            />
          </div>
        </Row>

        <Row
          label="退出时备份"
          description="页面切到后台或关闭时自动下载一份（纯前端尽力而为）"
        >
          <Switch
            checked={autoBackupOnExit}
            onChange={(checked) => setSetting('autoBackupOnExit', checked)}
          />
        </Row>

        <p className="text-xs text-faint">
          自动备份文件名含日期（如 fc-arcade-backup-2026-08-12.fcab），会直接下载、不弹保存位置。
          整窗关闭时的下载能否成功取决于浏览器，属纯前端离线应用的固有限制。
        </p>
      </Section>

      <Section
        title="数据清理"
        description="删除本地存储的游戏数据。建议清理前先导出备份。"
      >
        <Row
          label="清空所有存档"
          description="删除全部即时存档与自动存档，操作不可逆"
        >
          <Button
            variant="danger"
            size="sm"
            icon={<IconTrash size={15} />}
            onClick={() => setPendingClear('saves')}
            disabled={clearing}
          >
            清空存档
          </Button>
        </Row>

        <Row
          label="清空所有 ROM"
          description="删除全部 ROM 二进制文件，保留游戏记录与封面"
        >
          <Button
            variant="danger"
            size="sm"
            icon={<IconTrash size={15} />}
            onClick={() => setPendingClear('roms')}
            disabled={clearing}
          >
            清空 ROM
          </Button>
        </Row>

        <Row
          label="清空游戏记录与封面"
          description="删除游戏库条目、自定义/截图封面、游玩记录与 CRC 学习记录；不删 ROM 与存档"
        >
          <Button
            variant="danger"
            size="sm"
            icon={<IconTrash size={15} />}
            onClick={() => setPendingClear('records')}
            disabled={clearing}
          >
            清空记录
          </Button>
        </Row>

        <Row
          label="清空全部数据"
          description="删除游戏、ROM、封面、存档、会话等所有本地数据，相当于恢复初始状态"
        >
          <Button
            variant="danger"
            size="sm"
            icon={<IconTrash size={15} />}
            onClick={() => setPendingClear('all')}
            disabled={clearing}
          >
            清空全部
          </Button>
        </Row>

        <p className="text-xs text-faint">
          以上操作均只影响 IndexedDB 中的数据，不会删除浏览器设置。建议重大清理前导出备份。
        </p>
      </Section>

      <Dialog
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false)
          pendingFile.current = null
        }}
        title="预览备份内容"
        description="确认无误后再恢复。下方为这份备份中包含的数据量概览。"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setPreviewOpen(false)
                pendingFile.current = null
              }}
              disabled={mode === 'import'}
            >
              取消
            </Button>
            <Button
              variant={replace ? 'danger' : 'primary'}
              loading={mode === 'import'}
              onClick={() => {
                if (pendingFile.current) void runImport(pendingFile.current)
              }}
            >
              开始恢复
            </Button>
          </div>
        }
      >
        {preview ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <PreviewStat label="游戏" value={preview.games} />
              <PreviewStat label="ROM" value={preview.roms} />
              <PreviewStat label="存档" value={preview.saveStates} />
              <PreviewStat label="封面" value={preview.covers} />
              <PreviewStat label="会话" value={preview.sessions} />
              <PreviewStat label="CRC 学习" value={preview.crcLearn} />
            </div>

            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
              <div>生成时间：{new Date(preview.manifest.createdAt).toLocaleString()}</div>
              <div>
                应用版本：v{preview.manifest.appVersion} · 备份格式 v{preview.manifest.version}
              </div>
              <div>含设置：{preview.settings ? '是' : '否'}</div>
            </div>

            {preview.sampleTitles.length > 0 ? (
              <div>
                <div className="mb-1.5 text-xs text-faint">包含的游戏（抽样）</div>
                <ul className="flex flex-col gap-1">
                  {preview.sampleTitles.map((title, i) => (
                    <li
                      key={i}
                      className="truncate rounded-md bg-surface px-2.5 py-1.5 text-sm text-text"
                    >
                      {title}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Row
              label="恢复前清空现有数据"
              description="勾选后，恢复会先删除本机全部游戏 / ROM / 存档，再写入备份"
            >
              <Switch checked={replace} onChange={setReplace} />
            </Row>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={pendingClear === 'saves'}
        title="清空所有存档？"
        description="这将删除全部即时存档、自动存档与存档缩略图，操作不可逆。建议先导出备份。"
        confirmText="清空存档"
        danger
        loading={clearing}
        onCancel={() => setPendingClear(null)}
        onConfirm={() => void handleClearSaves()}
      />

      <ConfirmDialog
        open={pendingClear === 'roms'}
        title="清空所有 ROM？"
        description="这将删除全部 ROM 二进制文件，但保留游戏库记录、封面与存档。被清空的 ROM 需要重新导入才能运行。"
        confirmText="清空 ROM"
        danger
        loading={clearing}
        onCancel={() => setPendingClear(null)}
        onConfirm={() => void handleClearRoms()}
      />

      <ConfirmDialog
        open={pendingClear === 'records'}
        title="清空游戏记录与封面？"
        description="这将删除全部游戏库条目、封面、游玩记录与 CRC 学习记录。ROM 二进制与存档不会被删除，但会失去对应的游戏条目。"
        confirmText="清空记录"
        danger
        loading={clearing}
        onCancel={() => setPendingClear(null)}
        onConfirm={() => void handleClearRecords()}
      />

      <ConfirmDialog
        open={pendingClear === 'all'}
        title="清空全部数据？"
        description="这将删除游戏库、ROM、封面、存档、会话等所有本地数据，应用将恢复到初始状态。此操作不可逆，请务必先备份。"
        confirmText="清空全部"
        danger
        loading={clearing}
        onCancel={() => setPendingClear(null)}
        onConfirm={() => void handleClearAll()}
      />
    </>
  )
}

/* --------------------------------- 页面 --------------------------------- */

const TABS = [
  { value: 'appearance', label: '外观', icon: <IconPalette size={16} /> },
  { value: 'audio', label: '音频', icon: <IconVolume size={16} /> },
  { value: 'screen', label: '画面', icon: <IconChip size={16} /> },
  { value: 'controls', label: '控制', icon: <IconGamepad size={16} /> },
  { value: 'keyboard', label: '键盘', icon: <IconKeyboard size={16} /> },
  { value: 'data', label: '数据', icon: <IconDownload size={16} /> },
] as const

/** 设置页 tab 内容切换动画 */
const settingsTabVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

function SettingsTabPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={settingsTabVariants}
      transition={{ type: 'spring' as const, stiffness: 520, damping: 30, mass: 0.6 }}
    >
      {children}
    </motion.div>
  )
}

export function SettingsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('appearance')
  const resetSettings = useSettingsStore((s) => s.resetSettings)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel-cn text-xl text-text">设置</h1>
          <p className="text-xs text-muted">主题、音频、模拟器与控制器</p>
        </div>
        <Button
          variant="ghost"
          icon={<IconReset size={15} />}
          onClick={resetSettings}
        >
          恢复默认
        </Button>
      </header>

      <Tabs value={tab} onChange={setTab} items={TABS} className="mb-6" />

      <AnimatePresence mode="wait">
        <div key={tab} className="flex flex-col gap-5">
          {tab === 'appearance' ? <SettingsTabPanel><AppearanceSection /></SettingsTabPanel> : null}
          {tab === 'audio' ? <SettingsTabPanel><AudioSection /></SettingsTabPanel> : null}
          {tab === 'screen' ? <SettingsTabPanel><ScreenSection /></SettingsTabPanel> : null}
          {tab === 'controls' ? <SettingsTabPanel><ControlsSection /></SettingsTabPanel> : null}
          {tab === 'keyboard' ? <SettingsTabPanel><KeyboardSection /></SettingsTabPanel> : null}
          {tab === 'data' ? <SettingsTabPanel><DataSection /></SettingsTabPanel> : null}
        </div>
      </AnimatePresence>
    </div>
  )
}
