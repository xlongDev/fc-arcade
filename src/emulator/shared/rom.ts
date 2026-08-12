/**
 * iNES ROM 头部解析与格式转换。
 * 提前做校验的目的：在把数据交给内核之前就给出可读的中文报错，
 * 而不是让用户看到内核抛出的英文栈。
 */
import { EmulatorError } from '@/types/emulator'

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
 * iNES 1.0 的 bytes 8-15 应当是 0；很多老 dump 在这些字节里写了签名（如 DiskDude!），
 * 会污染 byte 7 的高 4 位。这里按标准约定丢弃高 4 位，避免把实际能跑的游戏误判成不支持的 mapper。
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
    // iNES 1.0 兼容启发式：若 bytes 8-15 有任何非 0，说明是旧格式，byte 7 高 4 位（mapper 高位）应被忽略
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
