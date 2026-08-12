/**
 * nostalgist（RetroArch / libretro fceumm 核心）适配器。目前项目唯一的内核。
 *
 * 这个适配器和一般「每帧推进」的模拟器结构差很多，原因如下：
 *
 * 1. 时序不归我们管。RetroArch 在 WASM 里跑自己的主循环并按 vsync 节流，
 *    所以这里没有「跑一帧」的概念，我们的 rAF 只负责下发输入差分和累计时长。
 *
 * 2. 输入是「合成键盘事件」。nostalgist 的 pressDown(button, player) 会去
 *    RetroArch 配置里查 input_playerN_<button> 绑定的按键，再合成一个
 *    KeyboardEvent 塞给 Emscripten。因此：
 *    - 必须显式绑定玩家 2 的按键，RetroArch 默认只给玩家 1 绑了键盘；
 *    - 必须 respondToGlobalEvents: false，否则用户真实按键会被 RetroArch
 *      直接吃掉，和我们自己的 KeyboardSource 叠加成双份输入。
 *
 * 3. 整个模块只在用户真的切到这个内核时才会被 import（见 emulator/index.ts），
 *    nostalgist 本身还要再动态 import 一层，确保 RetroArch 的加载器不进首屏包。
 */
import type * as NostalgistModule from 'nostalgist'
import type { Nostalgist } from 'nostalgist'
import type {
  EmulatorAdapter,
  EmulatorCore,
  EmulatorEventMap,
  EmulatorOptions,
  EmulatorStats,
  EmulatorStatus,
  SaveStatePayload,
  ScreenshotOptions,
} from '@/types/emulator'
import { EmulatorError, NES_FPS, NES_OVERSCAN_X, NES_VISIBLE_HEIGHT, NES_VISIBLE_WIDTH } from '@/types/emulator'
import type { ButtonMask, InputState, NesButton, PlayerIndex } from '@/types/input'
import { BUTTON_BIT, EMPTY_INPUT_STATE } from '@/types/input'
import type { Unsubscribe } from '@/types/common'
import { Emitter } from '@/lib/emitter'
import { parseRomHeader } from '@/emulator/shared/rom'
import { assertPayload, createPayload } from '@/emulator/shared/saveState'
import { rescaleBlob } from '@/emulator/shared/canvas'

/** 见文件头注释：Emitter 的泛型约束要求 Record<string, unknown>，interface 不满足 */
type EmulatorEvents = { [K in keyof EmulatorEventMap]: EmulatorEventMap[K] }

/**
 * nostalgist 只导出了 Nostalgist 这一个符号，NostalgistLaunchOptions 是包内私有类型。
 * 从静态方法签名上反推，避免手抄一份会和上游脱节的结构。
 * 这里用的是 import type 命名空间，编译后会被完全擦除，不会引入运行时依赖。
 */
type NostalgistStatic = typeof NostalgistModule.Nostalgist
type LaunchOptions = Parameters<NostalgistStatic['launch']>[0]

const CORE_NAME = 'fceumm'

/**
 * fceumm 内核本地化：把 fceumm_libretro.js / .wasm 放在 public/cores 下，离线也能跑。
 * 用 BASE_URL 拼接，兼容子路径部署（如 GitHub Pages 的 /fc-arcade/）。
 */
const LOCAL_CORE_BASE = `${import.meta.env.BASE_URL}cores`

/** RetroArch 里玩家编号从 1 开始 */
const PLAYER_NUMBER: readonly [number, number] = [1, 2]

const BUTTON_ORDER: readonly NesButton[] = [
  'a',
  'b',
  'select',
  'start',
  'up',
  'down',
  'left',
  'right',
]

/**
 * 玩家 2 的键盘绑定。这些键不会真的被用户按到 —— 它们只是
 * pressDown/pressUp 内部用来定位 RetroArch 输入槽的「令牌」。
 * 取值刻意避开 RetroArch 玩家 1 的默认绑定（x z s a q w + 方向键 + enter/rshift），
 * 否则玩家 1 的按键会同时触发玩家 2。
 */
const PLAYER2_BINDINGS = {
  input_player2_a: 'g',
  input_player2_b: 'h',
  input_player2_select: 't',
  input_player2_start: 'y',
  input_player2_up: 'i',
  input_player2_down: 'k',
  input_player2_left: 'j',
  input_player2_right: 'l',
} as const

/** 统计窗口长度（毫秒） */
const STATS_WINDOW_MS = 1000

export class NostalgistAdapter implements EmulatorAdapter {
  readonly core: EmulatorCore = 'nostalgist'

  #status: EmulatorStatus = 'idle'
  #emitter = new Emitter<EmulatorEvents>()
  #nostalgist: Nostalgist | null = null

  #canvas: HTMLCanvasElement | null = null
  #rom: ArrayBuffer | null = null
  #contextLostHandler = ((event: Event) => {
    event.preventDefault()
    if (this.#disposed) return
    // WebGL 上下文丢失会导致画面黑屏但音频可能还在跑，先停下来并上报，
    // 让上层自动 fallback 到另一个内核
    this.#stopLoop()
    this.#setStatus('error')
    this.#emitter.emit(
      'error',
      new EmulatorError('runtime', 'WebGL 上下文丢失，将自动尝试恢复'),
    )
  }) as EventListener

  #options: Required<Pick<EmulatorOptions, 'volume' | 'audio' | 'integerScale'>> & {
    coreBaseUrl?: string
  } = { volume: 0.7, audio: true, integerScale: false, coreBaseUrl: LOCAL_CORE_BASE }

  #rafId: number | null = null
  #disposed = false
  #started = false
  #firstFrameEmitted = false
  #autoPaused = false

  #input: InputState = EMPTY_INPUT_STATE
  #appliedMasks: [ButtonMask, ButtonMask] = [0, 0]

  #runningMs = 0
  #playtimeSec = 0
  #lastTickAt = 0
  #statsWindowStart = 0
  #statsTicks = 0
  #stats: EmulatorStats = { fps: 0, audioBuffered: 0, skippedFrames: 0, frameCostMs: 0 }

  #onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      if (this.#status === 'running') {
        this.#autoPaused = true
        this.pause()
      }
    } else if (this.#autoPaused) {
      this.#autoPaused = false
      this.resume()
    }
  }

  get status(): EmulatorStatus {
    return this.#status
  }

  async init(canvas: HTMLCanvasElement, options: EmulatorOptions = {}): Promise<void> {
    if (this.#disposed) throw new EmulatorError('runtime', '模拟器已释放，无法重新初始化')

    this.#options = {
      volume: options.volume ?? this.#options.volume,
      audio: options.audio ?? this.#options.audio,
      integerScale: options.integerScale ?? this.#options.integerScale,
      coreBaseUrl: options.coreBaseUrl ?? this.#options.coreBaseUrl,
    }

    document.addEventListener('visibilitychange', this.#onVisibilityChange)

    const changedCanvas = this.#canvas !== null && this.#canvas !== canvas
    if (changedCanvas) {
      this.#canvas?.removeEventListener('webglcontextlost', this.#contextLostHandler)
      canvas.addEventListener('webglcontextlost', this.#contextLostHandler)
    }
    this.#canvas = canvas

    // RetroArch 的 WebGL 上下文绑死在启动时那个 canvas 上，换 canvas 只能整个重启
    if (changedCanvas && this.#rom) {
      const rom = this.#rom
      this.#teardownInstance()
      await this.loadRom(rom)
      return
    }

    if (this.#status === 'idle') this.#setStatus('ready')
  }

  async loadRom(rom: ArrayBuffer): Promise<void> {
    if (this.#disposed) throw new EmulatorError('runtime', '模拟器已释放')
    const canvas = this.#canvas
    if (!canvas) throw new EmulatorError('runtime', '请先调用 init 绑定画布')

    this.#setStatus('loading')
    try {
      // fceumm 支持极广的 mapper 范围，这里只做 iNES 头校验，不做 mapper 白名单
      parseRomHeader(rom)

      this.#teardownInstance()
      this.#rom = rom
      this.#resetCounters()

      const { Nostalgist: NostalgistClass } = await import('nostalgist')
      const nostalgist = await NostalgistClass.launch(this.#buildLaunchOptions(canvas, rom))

      if (this.#disposed) {
        nostalgist.exit({ removeCanvas: false })
        return
      }

      this.#nostalgist = nostalgist
      this.#started = false
      this.#appliedMasks = [0, 0]
      this.#applyVolume()
      this.#setStatus('ready')
    } catch (error) {
      this.#setStatus('error')
      const emulatorError = this.#toEmulatorError(error)
      this.#emitter.emit('error', emulatorError)
      throw emulatorError
    }
  }

  start(): void {
    const nostalgist = this.#nostalgist
    if (!nostalgist || this.#disposed) return
    if (this.#status === 'running') return

    this.#setStatus('running')
    if (this.#started) {
      nostalgist.resume()
      this.#startLoop()
      return
    }

    this.#started = true
    // launch 时用了 runEmulatorManually，真正跑起来要显式 start
    void nostalgist
      .start()
      .then(() => {
        if (this.#disposed) return
        this.#applyVolume()
        if (!this.#firstFrameEmitted) {
          this.#firstFrameEmitted = true
          this.#emitter.emit('firstframe', undefined)
        }
      })
      .catch((error: unknown) => {
        this.#started = false
        this.#setStatus('error')
        this.#emitter.emit('error', this.#toEmulatorError(error))
      })
    this.#startLoop()
  }

  pause(): void {
    if (this.#status !== 'running') return
    this.#stopLoop()
    this.#releaseAllButtons()
    this.#nostalgist?.pause()
    this.#setStatus('paused')
  }

  resume(): void {
    if (this.#disposed || !this.#nostalgist) return
    if (this.#status !== 'paused') return
    this.#nostalgist.resume()
    this.#setStatus('running')
    this.#startLoop()
  }

  reset(): void {
    const nostalgist = this.#nostalgist
    if (!nostalgist || !this.#started) return
    try {
      this.#releaseAllButtons()
      nostalgist.restart()
      this.#resetCounters()
      // restart() 内部会 resume，状态要跟上，否则 UI 上还显示暂停
      if (this.#status === 'paused') {
        this.#setStatus('running')
        this.#startLoop()
      }
    } catch (cause) {
      this.#setStatus('error')
      this.#emitter.emit('error', this.#toEmulatorError(cause))
    }
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    document.removeEventListener('visibilitychange', this.#onVisibilityChange)
    this.#canvas?.removeEventListener('webglcontextlost', this.#contextLostHandler)
    this.#teardownInstance()
    this.#canvas = null
    this.#rom = null
    this.#emitter.clear()
    this.#status = 'idle'
  }

  setVolume(volume: number): void {
    this.#options.volume = clamp01(volume)
    this.#applyVolume()
  }

  /**
   * RetroArch 自己创建 AudioContext，页面没有用户手势时它会停在 suspended。
   * 这里从 Emscripten 的 OpenAL 实现里把 AudioContext 摸出来 resume。
   */
  async unlockAudio(): Promise<void> {
    const context = this.#findAudioContext()
    if (!context) return
    if (context.state === 'running') return
    try {
      await context.resume()
    } catch (cause) {
      throw new EmulatorError('audio-blocked', '音频被浏览器拦截，请点击画面后重试', { cause })
    }
  }

  setInput(state: InputState): void {
    this.#input = state
  }

  async saveState(): Promise<SaveStatePayload> {
    const nostalgist = this.#nostalgist
    if (!nostalgist || !this.#started) {
      throw new EmulatorError('save-state-failed', '游戏还没开始运行，无法存档')
    }
    try {
      const { state } = await nostalgist.saveState()
      const bytes = new Uint8Array(await state.arrayBuffer())
      if (bytes.byteLength === 0) {
        throw new EmulatorError('save-state-failed', '存档内容为空，请等游戏画面出现后再试')
      }
      return createPayload('nostalgist', bytes)
    } catch (cause) {
      if (cause instanceof EmulatorError) throw cause
      throw new EmulatorError('save-state-failed', '存档失败，请稍后重试', { cause })
    }
  }

  async loadState(payload: SaveStatePayload): Promise<void> {
    const nostalgist = this.#nostalgist
    if (!nostalgist || !this.#started) {
      throw new EmulatorError('load-state-failed', '游戏还没开始运行，无法读档')
    }
    assertPayload(payload, 'nostalgist')

    try {
      // 复制一份再交出去：payload.data 可能是 IndexedDB 里那份的视图，
      // 而 nostalgist 会把它写进 Emscripten FS，不该让底层 buffer 被牵连
      await nostalgist.loadState(new Blob([payload.data.slice()]))
    } catch (cause) {
      throw new EmulatorError('load-state-failed', '读档失败，存档可能与当前 ROM 不匹配', { cause })
    }
    this.#appliedMasks = [0, 0]
  }

  async screenshot(options: ScreenshotOptions = {}): Promise<Blob> {
    const nostalgist = this.#nostalgist
    if (!nostalgist || !this.#started) {
      throw new EmulatorError('runtime', '游戏还没开始运行，无法截图')
    }
    const raw = await nostalgist.screenshot()
    // 裁掉左右过扫描区：RetroArch 截图是 256x240 的 NES native 画面，
    // 左右各 8px 是过扫描，不少游戏会泄背景色（红线就来自这里）。
    return await rescaleBlob(raw, options.scale ?? 2, options.type ?? 'image/png', options.quality, {
      x: NES_OVERSCAN_X,
      y: 0,
      width: NES_VISIBLE_WIDTH,
      height: NES_VISIBLE_HEIGHT,
    })
  }

  getStats(): EmulatorStats {
    return this.#stats
  }

  on<K extends keyof EmulatorEventMap>(
    event: K,
    listener: (payload: EmulatorEventMap[K]) => void,
  ): Unsubscribe {
    return this.#emitter.on(event, listener)
  }

  /* ----------------------------- 内部实现 ----------------------------- */

  #buildLaunchOptions(canvas: HTMLCanvasElement, rom: ArrayBuffer): LaunchOptions {
    const base = this.#options.coreBaseUrl?.replace(/\/+$/, '')

    return {
      core: CORE_NAME,
      // 必须带 .nes 后缀：RetroArch 靠扩展名判断内容类型
      rom: { fileContent: new Blob([rom]), fileName: 'game.nes' },
      element: canvas,
      // 关掉全局键盘接管，输入统一由我们的 InputManager 下发，见文件头注释
      respondToGlobalEvents: false,
      runEmulatorManually: true,
      retroarchConfig: {
        ...PLAYER2_BINDINGS,
        // 存档缩略图会让 saveState 多产出一张 PNG，我们用不到，关掉省内存
        savestate_thumbnail_enable: false,
        video_smooth: false,
        video_scale_integer: this.#options.integerScale,
        // WebGL GPU 截图在某些环境下会读到已清空的缓冲而黑屏，
        // 强制从 RetroArch 内部帧缓冲截图，避免封面/截图全黑。
        video_gpu_screenshot: false,
        // 左右过扫描区（NES 两侧各 8px）的裁剪不放这里：
        // RetroArch 的 video_crop_overscan 经 nostalgist 传入后不生效。
        // 改为在 EmulatorScreen（CSS overflow 裁显示）和 screenshot（rescaleBlob 裁 Blob）层处理。
        // RetroArch 自带的 OSD 提示、帧率显示和快捷菜单在嵌入场景里只会干扰
        video_font_enable: false,
        fps_show: false,
        menu_driver: 'null',
        audio_enable: this.#options.audio,
        audio_mute_enable: false,
        audio_volume: volumeToDb(this.#options.audio ? this.#options.volume : 0),
      },
      ...(base
        ? {
            resolveCoreJs: () => `${base}/${CORE_NAME}_libretro.js`,
            resolveCoreWasm: () => `${base}/${CORE_NAME}_libretro.wasm`,
          }
        : {}),
    }
  }

  #startLoop(): void {
    if (this.#rafId !== null) return
    this.#lastTickAt = performance.now()
    this.#statsWindowStart = this.#lastTickAt
    this.#statsTicks = 0
    this.#rafId = requestAnimationFrame(this.#tick)
  }

  #stopLoop(): void {
    if (this.#rafId === null) return
    cancelAnimationFrame(this.#rafId)
    this.#rafId = null
  }

  /**
   * 这个循环不驱动模拟，只做三件事：下发输入差分、累计运行时长、采样帧率。
   * 时长用墙上时钟而不是帧计数 —— RetroArch 实时运行，两者等价且前者不需要内部信息。
   */
  #tick = (now: number): void => {
    if (this.#disposed) return
    this.#rafId = requestAnimationFrame(this.#tick)
    if (this.#status !== 'running') return

    const elapsed = Math.min(250, now - this.#lastTickAt)
    this.#lastTickAt = now

    this.#applyInput()

    if (this.#started) {
      this.#runningMs += elapsed
      const seconds = Math.floor(this.#runningMs / 1000)
      if (seconds > this.#playtimeSec) {
        this.#playtimeSec = seconds
        this.#emitter.emit('playtime', seconds)
      }
    }

    this.#statsTicks++
    this.#updateStats(now)
  }

  #applyInput(): void {
    const nostalgist = this.#nostalgist
    if (!nostalgist || !this.#started) return

    for (let player = 0; player < PLAYER_NUMBER.length; player++) {
      const next = this.#input.players[player as PlayerIndex]
      const prev = this.#appliedMasks[player]
      if (next === prev) continue

      const changed = next ^ prev
      const number = PLAYER_NUMBER[player]
      for (const button of BUTTON_ORDER) {
        const bit = BUTTON_BIT[button]
        if ((changed & bit) === 0) continue
        if ((next & bit) === 0) nostalgist.pressUp({ button, player: number })
        else nostalgist.pressDown({ button, player: number })
      }
      this.#appliedMasks[player] = next
    }
  }

  #releaseAllButtons(): void {
    const nostalgist = this.#nostalgist
    if (!nostalgist || !this.#started) return
    for (let player = 0; player < PLAYER_NUMBER.length; player++) {
      const mask = this.#appliedMasks[player]
      if (mask === 0) continue
      const number = PLAYER_NUMBER[player]
      for (const button of BUTTON_ORDER) {
        if ((mask & BUTTON_BIT[button]) !== 0) nostalgist.pressUp({ button, player: number })
      }
      this.#appliedMasks[player] = 0
    }
  }

  /**
   * RetroArch 不向外暴露内部帧计数、音频水位和单帧耗时，所以这里只能给出
   * 由 rAF 采样得到的帧率近似值（并且 clamp 到 NES 的 60.0988，
   * 因为高刷屏上 rAF 比模拟帧率快，直接上报会误导）。其余字段恒为 0。
   */
  #updateStats(now: number): void {
    const windowMs = now - this.#statsWindowStart
    if (windowMs < STATS_WINDOW_MS) return

    const sampled = (this.#statsTicks / windowMs) * 1000
    this.#stats = {
      fps: Math.round(Math.min(NES_FPS, sampled) * 10) / 10,
      audioBuffered: 0,
      skippedFrames: 0,
      frameCostMs: 0,
    }
    this.#statsWindowStart = now
    this.#statsTicks = 0
    this.#emitter.emit('stats', this.#stats)
  }

  #applyVolume(): void {
    const gain = this.#findGainNode()
    if (!gain) return
    gain.gain.value = this.#options.audio ? this.#options.volume : 0
  }

  /**
   * Emscripten 的 OpenAL 移植把所有输出汇到 AL.currentCtx.gain 这个 GainNode 上，
   * 是这里唯一能拿到的音量控制点。结构属于实现细节，所以全程防御式取值，
   * 拿不到就静默放弃（音量条失效，但游戏照跑）。
   */
  #findGainNode(): GainNode | null {
    const ctx = this.#getAlContext()
    const gain = ctx ? readProperty(ctx, 'gain') : undefined
    return gain instanceof GainNode ? gain : null
  }

  #findAudioContext(): AudioContext | null {
    const ctx = this.#getAlContext()
    if (!ctx) return null
    for (const key of ['audioCtx', 'ctx', 'audioContext']) {
      const value = readProperty(ctx, key)
      if (value instanceof AudioContext) return value
    }
    // 退一步：从 GainNode 反查它所属的 context
    const gain = this.#findGainNode()
    return gain && gain.context instanceof AudioContext ? gain.context : null
  }

  #getAlContext(): Record<string, unknown> | null {
    const nostalgist = this.#nostalgist
    if (!nostalgist || !this.#started) return null
    let al: unknown
    try {
      al = nostalgist.getEmscriptenAL()
    } catch {
      return null
    }
    const current = readProperty(al, 'currentCtx')
    return isRecord(current) ? current : null
  }

  #teardownInstance(): void {
    this.#stopLoop()
    const nostalgist = this.#nostalgist
    this.#nostalgist = null
    this.#started = false
    this.#appliedMasks = [0, 0]
    if (!nostalgist) return
    try {
      // removeCanvas: false —— canvas 是上层 React 组件的，不能被我们摘掉
      nostalgist.exit({ removeCanvas: false })
    } catch {
      // 退出失败通常是实例已经崩了，没有可恢复的动作
    }
  }

  #resetCounters(): void {
    this.#runningMs = 0
    this.#playtimeSec = 0
    this.#statsTicks = 0
    this.#firstFrameEmitted = false
    this.#stats = { fps: 0, audioBuffered: 0, skippedFrames: 0, frameCostMs: 0 }
  }

  #setStatus(status: EmulatorStatus): void {
    if (this.#status === status) return
    this.#status = status
    this.#emitter.emit('status', status)
  }

  #toEmulatorError(error: unknown): EmulatorError {
    if (error instanceof EmulatorError) return error
    return new EmulatorError(
      'core-load-failed',
      'RetroArch 内核加载失败，请确认 public/cores 下的 fceumm_libretro.js / .wasm 存在，或检查网络连接',
      { cause: error },
    )
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

/** RetroArch 的 audio_volume 单位是分贝，0 表示原始音量，-80 是它认可的静音下限 */
function volumeToDb(volume: number): number {
  const linear = clamp01(volume)
  if (linear <= 0) return -80
  return Math.max(-80, Math.round(20 * Math.log10(linear) * 10) / 10)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readProperty(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined
}
