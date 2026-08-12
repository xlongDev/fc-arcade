/**
 * 存档载荷的构造与校验。
 * 两个内核的存档格式完全不兼容，所以 payload 里带 core 字段，
 * 跨内核读档时明确报错而不是静默把游戏读崩。
 */
import type { EmulatorCore, SaveStatePayload } from '@/types/emulator'
import { EmulatorError, normalizeCore } from '@/types/emulator'

export const SAVE_STATE_VERSION = 1

const CORE_LABEL: Record<EmulatorCore, string> = {
  jsnes: 'jsnes',
  fceumm: 'fceumm',
}

export function createPayload(core: EmulatorCore, data: Uint8Array): SaveStatePayload {
  return { core, version: SAVE_STATE_VERSION, createdAt: Date.now(), data }
}

export function assertPayload(payload: SaveStatePayload, expected: EmulatorCore): void {
  // 老存档的 core 字段可能还是遗留的 'nostalgist'，归一化后再比对
  const actual = normalizeCore(payload.core) ?? payload.core
  if (actual !== expected) {
    throw new EmulatorError(
      'core-mismatch',
      `这个存档来自 ${CORE_LABEL[actual] ?? actual} 内核，无法在 ${CORE_LABEL[expected]} 内核上读取，请先切换内核`,
    )
  }
  if (payload.version > SAVE_STATE_VERSION) {
    throw new EmulatorError('load-state-failed', '存档版本高于当前程序支持的版本，请升级后再试')
  }
  if (payload.data.byteLength === 0) {
    throw new EmulatorError('load-state-failed', '存档内容为空或已损坏')
  }
}

export function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}

export function decodeJson(data: Uint8Array): unknown {
  const text = new TextDecoder().decode(data)
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new EmulatorError('load-state-failed', '存档内容已损坏，无法解析', { cause })
  }
}
