/**
 * 主线程侧的 NES 音频输出。
 *
 * 职责：
 * 1. 把内核逐样本产出的音频攒成批（默认 512 帧）再 postMessage 给 worklet，
 *    避免每个样本一次跨线程调用（44100 次/秒的 postMessage 会直接把主线程压垮）。
 * 2. 维护「已缓冲样本数」这个水位读数，供上层做时序反压 —— 这是整套帧率同步的基准。
 * 3. 处理 Safari/iOS 的 AudioContext 自动播放限制（必须在用户手势后 resume）。
 */
import { AUDIO_SAMPLE_RATE, EmulatorError } from '@/types/emulator'
// 必须带 &no-inline：processor 文件小于 assetsInlineLimit(4096) 时 Vite 会把它
// base64 内联成 data URI，而 audioWorklet.addModule() 加载 data URI 在部分浏览器上
// 会抛 AbortError（vitejs/vite#6979）。dev 走真实文件 URL 所以本地测不出来。
import processorUrl from './nes-audio-processor.js?url&no-inline'

const PROCESSOR_NAME = 'nes-audio-processor'

/** 攒批帧数。512 帧 @44.1kHz ≈ 11.6ms，跨线程开销与延迟的折中。 */
const BATCH_FRAMES = 512

interface LevelMessage {
  type: 'level'
  buffered: number
  underruns: number
}

function isLevelMessage(value: unknown): value is LevelMessage {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    record['type'] === 'level' &&
    typeof record['buffered'] === 'number' &&
    typeof record['underruns'] === 'number'
  )
}

export class NesAudioOutput {
  #context: AudioContext | null = null
  #node: AudioWorkletNode | null = null
  #gain: GainNode | null = null

  /** 交错的 [L,R,...] 攒批缓冲 */
  #batch = new Float32Array(BATCH_FRAMES * 2)
  #batchFrames = 0

  /** worklet 回报的水位；两次回报之间用本地推送量做插值补偿 */
  #buffered = 0
  #underruns = 0
  #volume = 1
  #disposed = false

  #onWorkletMessage = (event: MessageEvent<unknown>): void => {
    if (isLevelMessage(event.data)) {
      this.#buffered = event.data.buffered
      this.#underruns = event.data.underruns
    }
  }

  get sampleRate(): number {
    return this.#context?.sampleRate ?? AUDIO_SAMPLE_RATE
  }

  /** 只有 AudioContext 真正在跑时，水位反压才是可信的时序基准 */
  get isRunning(): boolean {
    return this.#context?.state === 'running' && this.#node !== null
  }

  get isReady(): boolean {
    return this.#node !== null
  }

  get buffered(): number {
    return this.#buffered
  }

  get underruns(): number {
    return this.#underruns
  }

  /**
   * 创建 AudioContext 并加载 worklet。
   * 优先向浏览器请求 44100Hz，请求失败就接受设备原生采样率 —— 上层必须用
   * `sampleRate` 反查实际值再喂给内核，否则采样率不匹配会导致音调偏移和持续欠载。
   */
  async init(volume: number): Promise<void> {
    if (this.#disposed) return
    if (this.#context) {
      this.setVolume(volume)
      return
    }

    let context: AudioContext
    try {
      context = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE, latencyHint: 'interactive' })
    } catch {
      // 部分浏览器不允许指定 sampleRate，退回设备原生采样率
      try {
        context = new AudioContext({ latencyHint: 'interactive' })
      } catch (cause) {
        throw new EmulatorError('audio-blocked', '浏览器拒绝创建音频上下文，游戏将以静音方式运行', {
          cause,
        })
      }
    }

    try {
      await context.audioWorklet.addModule(processorUrl)
    } catch (cause) {
      await context.close().catch(() => undefined)
      throw new EmulatorError('audio-blocked', '音频处理器加载失败，游戏将以静音方式运行', { cause })
    }

    if (this.#disposed) {
      await context.close().catch(() => undefined)
      return
    }

    const node = new AudioWorkletNode(context, PROCESSOR_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    })
    node.port.addEventListener('message', this.#onWorkletMessage)
    // addEventListener 不像 onmessage 那样隐式启动端口，必须显式 start()
    node.port.start()

    const gain = context.createGain()
    gain.gain.value = clampVolume(volume)
    node.connect(gain)
    gain.connect(context.destination)

    this.#context = context
    this.#node = node
    this.#gain = gain
    this.#volume = clampVolume(volume)
  }

  /**
   * 内核的逐样本回调入口。热路径，只做最小工作。
   * 攒满一批自动 flush。
   */
  pushSample(left: number, right: number): void {
    if (!this.#node) return
    const offset = this.#batchFrames * 2
    this.#batch[offset] = left
    this.#batch[offset + 1] = right
    this.#batchFrames++
    if (this.#batchFrames >= BATCH_FRAMES) this.flush()
  }

  /** 把攒了一半的批次立即发出去（一帧模拟结束时调用，降低延迟抖动） */
  flush(): void {
    const node = this.#node
    if (!node || this.#batchFrames === 0) return
    const frames = this.#batchFrames
    this.#batchFrames = 0

    // 必须拷贝：底层 buffer 会被 transfer 掉，不能复用同一块内存
    const payload = this.#batch.slice(0, frames * 2)
    this.#buffered += frames
    node.port.postMessage({ type: 'samples', payload }, [payload.buffer])
  }

  /** 复位（reset / 读档后调用），丢掉旧音频避免串音 */
  reset(): void {
    this.#batchFrames = 0
    this.#buffered = 0
    this.#node?.port.postMessage({ type: 'reset' }, [])
  }

  setVolume(volume: number): void {
    this.#volume = clampVolume(volume)
    const gain = this.#gain
    const context = this.#context
    if (!gain || !context) return
    // 用短斜坡而不是直接赋值，避免音量突变产生爆音
    gain.gain.setTargetAtTime(this.#volume, context.currentTime, 0.01)
  }

  /** 用户手势后调用。Safari / iOS 上不 resume 就永远没有声音。 */
  async unlock(): Promise<void> {
    const context = this.#context
    if (!context) return
    if (this.isRunning) return
    try {
      await context.resume()
    } catch (cause) {
      throw new EmulatorError('audio-blocked', '音频被浏览器拦截，请点击画面后重试', { cause })
    }
    // resume() 可能 resolve 但状态仍是 suspended（未获得有效用户手势）
    if (!this.isRunning) {
      throw new EmulatorError('audio-blocked', '音频被浏览器拦截，请点击画面后重试')
    }
  }

  async suspend(): Promise<void> {
    const context = this.#context
    if (!context || context.state !== 'running') return
    await context.suspend().catch(() => undefined)
  }

  async dispose(): Promise<void> {
    this.#disposed = true
    const context = this.#context
    const node = this.#node
    this.#context = null
    this.#node = null
    this.#gain = null
    this.#batchFrames = 0
    this.#buffered = 0

    if (node) {
      node.port.postMessage({ type: 'close' }, [])
      node.port.removeEventListener('message', this.#onWorkletMessage)
      node.port.close()
      node.disconnect()
    }
    if (context) await context.close().catch(() => undefined)
  }

  get volume(): number {
    return this.#volume
  }
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 1
  return Math.min(1, Math.max(0, volume))
}
