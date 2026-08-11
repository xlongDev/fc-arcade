/**
 * iNES ROM 头部解析与格式转换。
 * 提前做校验的目的：在把数据交给内核之前就给出可读的中文报错，
 * 而不是让用户看到内核抛出的英文栈。
 */
import { EmulatorError } from '@/types/emulator'

/** jsnes 2.1.0 内置的 mapper 列表（node_modules/jsnes/src/mappers/index.js） */
export const JSNES_SUPPORTED_MAPPERS: ReadonlySet<number> = new Set([
  0, 1, 2, 3, 4, 5, 7, 9, 11, 34, 38, 66, 71, 79, 94, 118, 119, 140, 180, 240, 241,
])

export interface RomHeader {
  mapper: number
  prgBanks: number
  chrBanks: number
  hasTrainer: boolean
  hasBattery: boolean
  isNes2: boolean
}

/**
 * 校验 iNES 魔数并解出 mapper 号。非法 ROM 直接抛 invalid-rom。
 *
 * iNES 1.0 的 bytes 8-15 应当是 0；很多老 dump 在这些字节里写了签名（如 DiskDude!）。
 * jsnes 遇到这种情况会丢弃 byte 7 的高 4 位（只保留 mapper 低 4 位）。
 * 我们的检测必须与 jsnes 保持一致，否则会把实际能跑的游戏误判成不支持的 mapper。
 */
export function parseRomHeader(rom: ArrayBuffer): RomHeader {
  const bytes = new Uint8Array(rom)
  if (bytes.length < 16) {
    throw new EmulatorError('invalid-rom', '文件太小，不是有效的 NES ROM')
  }
  if (bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1a) {
    throw new EmulatorError('invalid-rom', '缺少 iNES 文件头，请确认这是 .nes 格式的 ROM')
  }

  const flags6 = bytes[6]
  const flags7 = bytes[7]
  const isNes2 = (flags7 & 0x0c) === 0x08
  let mapper = (flags6 >> 4) | (flags7 & 0xf0)
  if (isNes2) {
    // NES 2.0 把 mapper 高 4 位放在 byte 8 的低半字节
    mapper |= (bytes[8] & 0x0f) << 8
  } else if (mapper > 0x0f) {
    // iNES 1.0：如果 bytes 8-15 有任何非 0，jsnes 会忽略 byte 7 高 4 位
    let hasGarbage = false
    for (let i = 8; i < 16; i++) {
      if (bytes[i] !== 0) {
        hasGarbage = true
        break
      }
    }
    if (hasGarbage) {
      mapper = flags6 >> 4
    }
  }

  return {
    mapper,
    prgBanks: bytes[4],
    chrBanks: bytes[5],
    hasTrainer: (flags6 & 0x04) !== 0,
    hasBattery: (flags6 & 0x02) !== 0,
    isNes2,
  }
}

/**
 * jsnes 2.1.0 的 ROM.load 已原生接受 Uint8Array / ArrayBuffer
 * （见 node_modules/jsnes/src/rom.js 的 `data instanceof ArrayBuffer` 分支），
 * 不需要再转成 binary string —— 那会为一个几 MB 的 ROM 额外分配一份等长字符串。
 */
export function toRomBytes(rom: ArrayBuffer): Uint8Array {
  return new Uint8Array(rom)
}
