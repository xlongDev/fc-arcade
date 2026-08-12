/**
 * jsnes 内核适配器（默认内核，纯 JS，无 WASM/CDN 依赖）。
 *
 * 三个需要额外说明的设计决定：
 *
 * 1. 时序不用裸 rAF。rAF 在 120/144Hz 屏幕上一秒回调 120/144 次，
 *    每次跑一帧就会变成 2 倍速。这里改用「音频缓冲水位反压」：
 *    worklet 定期回报已缓冲样本数，低于低水位就补跑一帧，高于高水位就跳过本次。
 *    音频消费速率由硬件时钟决定，因此模拟速度会自动锁定到 60.0988Hz。
 *    音频不可用时退化为固定时间步长累加器。
 *
 * 2. 采样率以 AudioContext 实际值为准再喂给 jsnes。如果内核按 44100 产样本
 *    而设备跑 48000，缓冲会持续欠载，反压逻辑会误判成「跑得不够快」而狂追帧。
 *
 * 3. 每 rAF tick 最多推进一帧并 present 一次。jsnes 的 onFrame 在同步连跑多帧时
 *    容易触发 PPU 精灵/背景渲染异常，因此把追帧拆到多个 tick 完成。
 */
import type { ButtonKey, ControllerId, EmulatorData } from 'jsnes'
import { Controller, NES } from 'jsnes'
import type {
  EmulatorAdapter,
  EmulatorCore,
  EmulatorErrorCode,
  EmulatorEventMap,
  EmulatorOptions,
  EmulatorStats,
  EmulatorStatus,
  SaveStatePayload,
  ScreenshotOptions,
} from '@/types/emulator'
import { AUDIO_SAMPLE_RATE, EmulatorError, NES_FPS } from '@/types/emulator'
import type { ButtonMask, InputState, NesButton } from '@/types/input'
import { BUTTON_BIT, EMPTY_INPUT_STATE } from '@/types/input'
import type { Unsubscribe } from '@/types/common'
import { Emitter } from '@/lib/emitter'
import { NesAudioOutput } from '@/emulator/audio/NesAudioOutput'
import { NesRenderer } from '@/emulator/jsnes/NesRenderer'
import { JSNES_SUPPORTED_MAPPERS, parseRomHeader, toRomBytes } from '@/emulator/shared/rom'
import {
  assertPayload,
  createPayload,
  decodeJson,
  encodeJson,
} from '@/emulator/shared/saveState'

/**
 * 缓冲高水位（帧）：高于这个值跳过本次执行。
 * 取 6 而不是 8 —— 高水位直接等于音频延迟上限，6 帧 ≈ 100ms 已是可接受上限。
 */
const HIGH_WATER_FRAMES = 6
/** 单次 tick 的补帧上限，防止卡顿后疯狂追帧造成雪崩 */
const MAX_FRAMES_PER_TICK = 4
/** 无音频模式下的 dt 裁剪上限（毫秒），防止切回标签页时追帧 */
const MAX_DELTA_MS = 250

const FRAME_INTERVAL_MS = 1000 / NES_FPS

const BUTTON_TO_JSNES: Readonly<Record<NesButton, ButtonKey>> = {
  a: Controller.BUTTON_A,
  b: Controller.BUTTON_B,
  select: Controller.BUTTON_SELECT,
  start: Controller.BUTTON_START,
  up: Controller.BUTTON_UP,
  down: Controller.BUTTON_DOWN,
  left: Controller.BUTTON_LEFT,
  right: Controller.BUTTON_RIGHT,
}

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

/** jsnes 的手柄编号是 1 / 2，与 PlayerIndex 的 0 / 1 差一 */
const CONTROLLERS: readonly ControllerId[] = [1, 2]

/**
 * Emitter 的泛型约束要求 Record<string, unknown>，而 interface 不会获得隐式索引签名。
 * 用映射类型「拷贝」一份等价的类型别名绕过这个限制，事件签名保持不变。
 */
type EmulatorEvents = { [K in keyof EmulatorEventMap]: EmulatorEventMap[K] }

function isEmulatorData(value: unknown): value is EmulatorData {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record['cpu'] === 'object' &&
    typeof record['ppu'] === 'object' &&
    typeof record['papu'] === 'object' &&
    typeof record['mmap'] === 'object'
  )
}

export class JsnesAdapter implements EmulatorAdapter {
  readonly core: EmulatorCore = 'jsnes'

  #status: EmulatorStatus = 'idle'
  #emitter = new Emitter<EmulatorEvents>()
  #renderer = new NesRenderer()
  #audio = new NesAudioOutput()
  #nes: NES | null = null
  /** 载入的 ROM 本体，reset() 时用来干净地重新初始化（而不是依赖 nes.reset()，后者在音频/输入状态错乱时容易卡死） */
  #rom: ArrayBuffer | null = null

  #options: Required<Pick<EmulatorOptions, 'volume' | 'audio' | 'integerScale'>> = {
    volume: 0.7,
    audio: true,
    integerScale: false,
  }

  #rafId: number | null = null
  #lastTickAt = 0
  #accumulator = 0
  #disposed = false
  #firstFrameEmitted = false

  /** 当前注入的输入与上一帧已下发给内核的输入，用于差分 buttonDown/buttonUp */
  #input: InputState = EMPTY_INPUT_STATE
  #appliedMasks: [ButtonMask, ButtonMask] = [0, 0]

  /** 因页面隐藏而自动暂停，恢复可见时需要自动继续 */
  #autoPaused = false

  #emulatedFrames = 0
  #playtimeSec = 0
  #skippedFrames = 0
  #statsWindowStart = 0
  #statsFrames = 0
  #statsCostMs = 0
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
    }

    this.#renderer.attach(canvas, this.#options.integerScale)
    document.addEventListener('visibilitychange', this.#onVisibilityChange)

    if (this.#options.audio && !this.#audio.isReady) {
      try {
        await this.#audio.init(this.#options.volume)
      } catch (error) {
        // 音频初始化失败不应该阻断游戏，退化为静音 + 固定步长时序
        this.#emitError(error, 'audio-blocked', '音频初始化失败，已切换为静音模式')
      }
    } else if (this.#audio.isReady) {
      this.#audio.setVolume(this.#options.volume)
    }

    if (this.#status === 'idle') this.#setStatus('ready')
  }

  async loadRom(rom: ArrayBuffer): Promise<void> {
    if (this.#disposed) throw new EmulatorError('runtime', '模拟器已释放')
    this.#setStatus('loading')

    try {
      const header = parseRomHeader(rom)
      if (!JSNES_SUPPORTED_MAPPERS.has(header.mapper)) {
        throw new EmulatorError(
          'unsupported-mapper',
          `该 ROM 使用的 Mapper ${header.mapper} 暂不支持，可尝试切换到 fceumm 内核`,
        )
      }

      this.#stopLoop()
      this.#audio.reset()
      this.#renderer.clear()
      this.#resetCounters()

      const nes = this.#createNes()
      try {
        nes.loadROM(toRomBytes(rom))
      } catch (cause) {
        throw new EmulatorError(
          'unsupported-mapper',
          `该 ROM 使用的 Mapper ${header.mapper} 暂不支持，可尝试切换到 fceumm 内核`,
          { cause },
        )
      }

      this.#nes = nes
      this.#rom = rom
      this.#appliedMasks = [0, 0]
      this.#setStatus('ready')
    } catch (error) {
      this.#setStatus('error')
      const emulatorError =
        error instanceof EmulatorError
          ? error
          : new EmulatorError('invalid-rom', 'ROM 加载失败，文件可能已损坏', { cause: error })
      this.#emitter.emit('error', emulatorError)
      throw emulatorError
    }
  }

  start(): void {
    if (!this.#nes || this.#disposed) return
    if (this.#status === 'running') return
    this.#setStatus('running')
    this.#startLoop()
  }

  pause(): void {
    if (this.#status !== 'running') return
    this.#stopLoop()
    this.#releaseAllButtons()
    this.#setStatus('paused')
    void this.#audio.suspend()
  }

  resume(): void {
    if (this.#disposed || !this.#nes) return
    if (this.#status !== 'paused') return
    this.#setStatus('running')
    void this.#audio.unlock().catch(() => undefined)
    this.#audio.reset()
    this.#startLoop()
  }

  reset(): void {
    const nes = this.#nes
    const rom = this.#rom
    // 没有 ROM 留存（理论上不该发生）时退化为原生 reset
    if (!nes || !rom) {
      nes?.reset()
      this.#audio.reset()
      this.#renderer.clear()
      this.#resetCounters()
      this.#appliedMasks = [0, 0]
      return
    }
    try {
      const wasRunning = this.#status === 'running'
      this.#stopLoop()
      this.#audio.reset()
      this.#renderer.clear()
      this.#resetCounters()
      const fresh = this.#createNes()
      fresh.loadROM(toRomBytes(rom))
      this.#nes = fresh
      this.#appliedMasks = [0, 0]
      // 重置前在跑就继续跑；暂停态下保留暂停，等待用户恢复
      if (wasRunning) this.#startLoop()
    } catch (cause) {
      this.#setStatus('error')
      this.#emitter.emit(
        'error',
        new EmulatorError('runtime', '重置失败，请重试（会自动换一个内核再试）', { cause }),
      )
    }
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#stopLoop()
    document.removeEventListener('visibilitychange', this.#onVisibilityChange)
    this.#nes = null
    this.#renderer.dispose()
    void this.#audio.dispose()
    this.#emitter.clear()
    this.#status = 'idle'
  }

  setVolume(volume: number): void {
    this.#options.volume = volume
    this.#audio.setVolume(volume)
  }

  async unlockAudio(): Promise<void> {
    if (!this.#options.audio) return
    if (!this.#audio.isReady) {
      await this.#audio.init(this.#options.volume)
    }
    await this.#audio.unlock()
  }

  setInput(state: InputState): void {
    this.#input = state
  }

  async saveState(): Promise<SaveStatePayload> {
    const nes = this.#nes
    if (!nes) throw new EmulatorError('save-state-failed', '还没有载入 ROM，无法存档')
    try {
      return createPayload('jsnes', encodeJson(nes.toJSON()))
    } catch (cause) {
      throw new EmulatorError('save-state-failed', '存档失败，请稍后重试', { cause })
    }
  }

  async loadState(payload: SaveStatePayload): Promise<void> {
    const nes = this.#nes
    if (!nes) throw new EmulatorError('load-state-failed', '还没有载入 ROM，无法读档')
    assertPayload(payload, 'jsnes')

    const state = decodeJson(payload.data)
    if (!isEmulatorData(state)) {
      throw new EmulatorError('load-state-failed', '存档格式不正确，可能不是 jsnes 内核产生的存档')
    }

    try {
      nes.fromJSON(state)
    } catch (cause) {
      if (cause instanceof EmulatorError) throw cause
      throw new EmulatorError('load-state-failed', '读档失败，存档可能与当前 ROM 不匹配', { cause })
    }

    this.#audio.reset()
    this.#appliedMasks = [0, 0]
  }

  async screenshot(options: ScreenshotOptions = {}): Promise<Blob> {
    return await this.#renderer.screenshot(
      options.scale ?? 2,
      options.type ?? 'image/png',
      options.quality,
    )
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

  #createNes(): NES {
    // 采样率必须与 AudioContext 实际值一致，否则反压会持续误判
    const sampleRate = this.#audio.isReady ? this.#audio.sampleRate : AUDIO_SAMPLE_RATE
    return new NES({
      sampleRate,
      emulateSound: this.#options.audio,
      onFrame: (framebuffer) => {
        this.#renderer.writeFrame(framebuffer)
      },
      onAudioSample: (left, right) => {
        this.#audio.pushSample(left, right)
      },
    })
  }

  #startLoop(): void {
    if (this.#rafId !== null) return
    this.#lastTickAt = performance.now()
    this.#accumulator = 0
    this.#statsWindowStart = this.#lastTickAt
    this.#statsFrames = 0
    this.#statsCostMs = 0
    this.#rafId = requestAnimationFrame(this.#tick)
  }

  #stopLoop(): void {
    if (this.#rafId === null) return
    cancelAnimationFrame(this.#rafId)
    this.#rafId = null
  }

  #tick = (now: number): void => {
    if (this.#disposed) return
    this.#rafId = requestAnimationFrame(this.#tick)

    const nes = this.#nes
    if (!nes || this.#status !== 'running') return

    const elapsed = Math.min(MAX_DELTA_MS, now - this.#lastTickAt)
    this.#lastTickAt = now

    let framesToRun: number
    if (this.#audio.isRunning) {
      framesToRun = this.#framesByAudioPressure()
    } else {
      // 无音频：固定时间步长累加器，dt 已在上面裁剪
      this.#accumulator += elapsed
      framesToRun = Math.floor(this.#accumulator / FRAME_INTERVAL_MS)
      if (framesToRun > MAX_FRAMES_PER_TICK) {
        this.#skippedFrames += framesToRun - MAX_FRAMES_PER_TICK
        framesToRun = MAX_FRAMES_PER_TICK
        this.#accumulator = 0
      } else {
        this.#accumulator -= framesToRun * FRAME_INTERVAL_MS
      }
    }

    // jsnes 的 onFrame 回调在同步连跑多帧时容易触发 PPU 时序/精灵渲染异常
    //（截图中的 sprite 乱码、撕裂）。参考 jsnes 官方 browser 实现，每 rAF tick
    // 最多推进并显示一帧，追帧交给后续 tick 自然完成，而不是一次 burst 跑完。
    if (framesToRun > 1) {
      this.#skippedFrames += framesToRun - 1
      framesToRun = 1
    }

    for (let i = 0; i < framesToRun; i++) {
      if (!this.#runFrame(nes)) return
    }

    if (framesToRun > 0) {
      this.#audio.flush()
      this.#renderer.present()
      if (!this.#firstFrameEmitted) {
        this.#firstFrameEmitted = true
        this.#emitter.emit('firstframe', undefined)
      }
      this.#updatePlaytime()
    }

    // 兜底重绘：这次 tick 没有跑帧时（音频反压跳过），仍把最后一帧重新刷到
    // 画布。浏览器在标签页隐藏、内存紧张或 canvas backing store 被回收后，
    // 可能出现「有声音但黑屏」，强制 present 一次可恢复。
    if (framesToRun === 0 && this.#status === 'running') {
      this.#renderer.present(true)
    }

    this.#updateStats(now)
  }

  /** 按音频缓冲水位决定这次 tick 是否要跑一帧。返回值已约束为 0 或 1。 */
  #framesByAudioPressure(): number {
    const samplesPerFrame = this.#audio.sampleRate / NES_FPS
    const buffered = this.#audio.buffered

    if (buffered > samplesPerFrame * HIGH_WATER_FRAMES) {
      this.#skippedFrames++
      return 0
    }
    // 低水位时也不burst多帧，而是保持每 tick 一帧让音频自然追上。
    // 同步连跑多帧会导致 PPU 精灵/背景渲染异常（参考 issue：画面乱码、撕裂）。
    return 1
  }

  /** 返回 false 表示内核崩溃，调用方应立即停止本轮循环 */
  #runFrame(nes: NES): boolean {
    this.#applyInput(nes)
    const started = performance.now()
    try {
      nes.frame()
    } catch (cause) {
      this.#stopLoop()
      this.#setStatus('error')
      this.#emitter.emit(
        'error',
        new EmulatorError('runtime', '模拟器运行出错，请尝试重置或切换到 fceumm 内核', {
          cause,
        }),
      )
      return false
    }
    this.#statsCostMs += performance.now() - started
    this.#statsFrames++
    this.#emulatedFrames++
    return true
  }

  /** 差分下发按键，避免每帧对 8×2 个按键无脑调用 buttonDown/buttonUp */
  #applyInput(nes: NES): void {
    for (let player = 0; player < CONTROLLERS.length; player++) {
      const next = this.#input.players[player] ?? 0
      const prev = this.#appliedMasks[player]
      if (next === prev) continue

      const changed = next ^ prev
      const controller = CONTROLLERS[player]
      for (const button of BUTTON_ORDER) {
        const bit = BUTTON_BIT[button]
        if ((changed & bit) === 0) continue
        if ((next & bit) !== 0) nes.buttonDown(controller, BUTTON_TO_JSNES[button])
        else nes.buttonUp(controller, BUTTON_TO_JSNES[button])
      }
      this.#appliedMasks[player] = next
    }
  }

  #releaseAllButtons(): void {
    const nes = this.#nes
    if (!nes) return
    for (let player = 0; player < CONTROLLERS.length; player++) {
      const mask = this.#appliedMasks[player]
      if (mask === 0) continue
      const controller = CONTROLLERS[player]
      for (const button of BUTTON_ORDER) {
        if ((mask & BUTTON_BIT[button]) !== 0) nes.buttonUp(controller, BUTTON_TO_JSNES[button])
      }
      this.#appliedMasks[player] = 0
    }
  }

  #updatePlaytime(): void {
    const seconds = Math.floor(this.#emulatedFrames / NES_FPS)
    if (seconds > this.#playtimeSec) {
      this.#playtimeSec = seconds
      this.#emitter.emit('playtime', seconds)
    }
  }

  #updateStats(now: number): void {
    const windowMs = now - this.#statsWindowStart
    if (windowMs < 1000) return

    this.#stats = {
      fps: Math.round((this.#statsFrames / windowMs) * 1000 * 10) / 10,
      audioBuffered: this.#audio.buffered,
      skippedFrames: this.#skippedFrames,
      frameCostMs:
        this.#statsFrames > 0
          ? Math.round((this.#statsCostMs / this.#statsFrames) * 100) / 100
          : 0,
    }
    this.#statsWindowStart = now
    this.#statsFrames = 0
    this.#statsCostMs = 0
    this.#emitter.emit('stats', this.#stats)
  }

  #resetCounters(): void {
    this.#emulatedFrames = 0
    this.#playtimeSec = 0
    this.#skippedFrames = 0
    this.#statsFrames = 0
    this.#statsCostMs = 0
    this.#accumulator = 0
    this.#firstFrameEmitted = false
    this.#stats = { fps: 0, audioBuffered: 0, skippedFrames: 0, frameCostMs: 0 }
  }

  #setStatus(status: EmulatorStatus): void {
    if (this.#status === status) return
    this.#status = status
    this.#emitter.emit('status', status)
  }

  #emitError(error: unknown, code: EmulatorErrorCode, message: string): void {
    const emulatorError =
      error instanceof EmulatorError ? error : new EmulatorError(code, message, { cause: error })
    this.#emitter.emit('error', emulatorError)
  }
}
