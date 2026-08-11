/**
 * 模拟器适配层契约。
 * jsnes（纯 JS，默认）与 nostalgist（libretro WASM，可选）都实现 EmulatorAdapter，
 * 上层 UI 只依赖这个接口，不感知内核差异。
 */
import type { Unsubscribe } from './common'
import type { InputState } from './input'

export type EmulatorCore = 'jsnes' | 'nostalgist'

export const NES_WIDTH = 256
export const NES_HEIGHT = 240
/** NTSC 实际帧率，不是整 60 */
export const NES_FPS = 60.0988
/**
 * 向 AudioContext 请求的首选采样率。
 *
 * 注意这只是「首选值」，不是可以到处硬编码的真值：
 * - jsnes 的 NESOptions.sampleRate 默认是 48000，不是 44100；
 * - 浏览器可以忽略 AudioContext 的 sampleRate 请求，回落到设备原生速率
 *   （常见 48000，部分蓝牙设备 16000）。
 *
 * 因此内核实例化时必须把 **实际的 AudioContext.sampleRate** 传给 jsnes，
 * 否则音高和播放速度都会偏。
 */
export const AUDIO_SAMPLE_RATE = 44100

export type EmulatorStatus = 'idle' | 'loading' | 'ready' | 'running' | 'paused' | 'error'

export type EmulatorErrorCode =
  | 'invalid-rom'
  | 'unsupported-mapper'
  | 'core-load-failed'
  | 'audio-blocked'
  | 'save-state-failed'
  | 'load-state-failed'
  | 'core-mismatch'
  | 'runtime'

export class EmulatorError extends Error {
  readonly code: EmulatorErrorCode

  constructor(code: EmulatorErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'EmulatorError'
    this.code = code
  }
}

export interface EmulatorOptions {
  /** 0~1 */
  volume?: number
  /** 是否启用音频（移动端首次进入可能被浏览器拦截） */
  audio?: boolean
  /** 整数倍缩放，保持像素锐利 */
  integerScale?: boolean
  /** nostalgist 专用：核心文件基础路径 */
  coreBaseUrl?: string
}

/** 存档载荷。core 字段用于跨内核读档时明确报错，而不是静默损坏。 */
export interface SaveStatePayload {
  core: EmulatorCore
  /** 格式版本，用于后续迁移 */
  version: number
  createdAt: number
  data: Uint8Array
}

export interface EmulatorStats {
  fps: number
  /** 音频 ring buffer 中已缓冲的样本数，用于反压诊断 */
  audioBuffered: number
  skippedFrames: number
  /** 单帧模拟耗时均值（毫秒） */
  frameCostMs: number
}

export interface ScreenshotOptions {
  /** 输出缩放倍数，默认 2 */
  scale?: number
  type?: 'image/png' | 'image/webp' | 'image/jpeg'
  quality?: number
}

export interface EmulatorEventMap {
  status: EmulatorStatus
  stats: EmulatorStats
  error: EmulatorError
  /** 首帧渲染完成，用于隐藏 loading */
  firstframe: void
  /** 累计运行秒数，用于「运行 10 秒自动截图」 */
  playtime: number
}

export interface EmulatorAdapter {
  readonly core: EmulatorCore
  readonly status: EmulatorStatus

  /** 绑定显示 canvas 并准备内核。可重复调用以换 canvas。 */
  init(canvas: HTMLCanvasElement, options?: EmulatorOptions): Promise<void>

  loadRom(rom: ArrayBuffer): Promise<void>

  start(): void
  pause(): void
  resume(): void
  reset(): void
  /** 释放 canvas / AudioContext / rAF，适配器不可再用 */
  dispose(): void

  /** 0~1 */
  setVolume(volume: number): void
  /** 用户手势后调用，解锁 Safari/iOS 的 AudioContext */
  unlockAudio(): Promise<void>

  /** 每帧由播放器注入 */
  setInput(state: InputState): void

  saveState(): Promise<SaveStatePayload>
  loadState(payload: SaveStatePayload): Promise<void>

  screenshot(options?: ScreenshotOptions): Promise<Blob>

  getStats(): EmulatorStats

  on<K extends keyof EmulatorEventMap>(
    event: K,
    listener: (payload: EmulatorEventMap[K]) => void,
  ): Unsubscribe
}

/** 内核工厂。nostalgist 走动态 import，不进首屏包。 */
export type EmulatorFactory = (core: EmulatorCore) => Promise<EmulatorAdapter>
