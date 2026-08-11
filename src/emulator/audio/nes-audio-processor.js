/**
 * NES 音频 AudioWorklet 处理器。
 *
 * 为什么是纯 JavaScript：这个文件通过 `?url` 直接交给 `audioWorklet.addModule()`，
 * 不经过 TS 转译，写 TS 语法会在运行时炸掉。
 *
 * 为什么不用 SharedArrayBuffer：静态托管无法设置 COOP/COEP 响应头，
 * 所以改用 port.postMessage 传 Float32Array 块，环形缓冲放在 worklet 内部。
 *
 * 欠载策略：不输出硬零（会有咔哒爆音），而是保持最后一个样本值并把增益线性淡到 0；
 * 数据恢复后再淡回 1。
 */

/** 环形缓冲容量（帧）。2 的幂，方便用掩码取模。约 0.74s @44.1kHz。 */
const RING_FRAMES = 1 << 15
const RING_MASK = RING_FRAMES - 1

/** 每 N 个渲染块向主线程回报一次水位（128 帧/块，8 块 ≈ 23ms @44.1kHz） */
const REPORT_INTERVAL_BLOCKS = 8

/** 淡入淡出时长（秒）。2ms 足够消掉爆音，又不会明显吃掉音量。 */
const FADE_SECONDS = 0.002

class NesAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()

    this.ringL = new Float32Array(RING_FRAMES)
    this.ringR = new Float32Array(RING_FRAMES)
    this.readIndex = 0
    this.writeIndex = 0
    this.available = 0

    this.lastL = 0
    this.lastR = 0
    /** 当前淡入淡出增益 */
    this.gain = 0
    this.fadeStep = 1 / Math.max(1, FADE_SECONDS * sampleRate)

    this.underruns = 0
    this.blockCount = 0
    this.alive = true

    this.port.addEventListener('message', (event) => {
      const data = event.data
      if (!data) return
      if (data.type === 'samples') {
        this.push(data.payload)
      } else if (data.type === 'reset') {
        this.reset()
      } else if (data.type === 'close') {
        this.alive = false
      }
    })
    // addEventListener 不像 onmessage 那样隐式启动端口，必须显式 start()
    this.port.start()
  }

  reset() {
    this.readIndex = 0
    this.writeIndex = 0
    this.available = 0
    this.lastL = 0
    this.lastR = 0
    this.gain = 0
    this.underruns = 0
  }

  /**
   * 写入交错的 [L, R, L, R, ...] 样本。
   * 溢出时丢弃最旧的数据而不是最新的 —— 宁可跳一小段也不要让延迟无限增长。
   */
  push(interleaved) {
    const frames = interleaved.length >> 1
    if (frames <= 0) return

    for (let i = 0; i < frames; i++) {
      const w = this.writeIndex
      this.ringL[w] = interleaved[i * 2]
      this.ringR[w] = interleaved[i * 2 + 1]
      this.writeIndex = (w + 1) & RING_MASK
    }

    this.available += frames
    if (this.available > RING_FRAMES) {
      const overflow = this.available - RING_FRAMES
      this.readIndex = (this.readIndex + overflow) & RING_MASK
      this.available = RING_FRAMES
    }
  }

  process(_inputs, outputs) {
    if (!this.alive) return false

    const output = outputs[0]
    if (!output || output.length === 0) return true

    const left = output[0]
    const right = output.length > 1 ? output[1] : output[0]
    const frames = left.length

    let underran = false

    for (let i = 0; i < frames; i++) {
      let l
      let r
      if (this.available > 0) {
        const read = this.readIndex
        l = this.ringL[read]
        r = this.ringR[read]
        this.readIndex = (read + 1) & RING_MASK
        this.available--
        this.lastL = l
        this.lastR = r
        // 有数据 → 淡回满增益
        if (this.gain < 1) this.gain = Math.min(1, this.gain + this.fadeStep)
      } else {
        // 欠载 → 保持最后一个样本并淡出，避免硬切产生的咔哒声
        underran = true
        l = this.lastL
        r = this.lastR
        if (this.gain > 0) this.gain = Math.max(0, this.gain - this.fadeStep)
      }

      const g = this.gain
      left[i] = l * g
      if (right !== left) right[i] = r * g
    }

    if (underran) this.underruns++

    this.blockCount++
    if (this.blockCount >= REPORT_INTERVAL_BLOCKS) {
      this.blockCount = 0
      this.port.postMessage(
        { type: 'level', buffered: this.available, underruns: this.underruns },
        [],
      )
    }

    return true
  }
}

registerProcessor('nes-audio-processor', NesAudioProcessor)
