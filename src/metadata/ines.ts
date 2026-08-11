/**
 * iNES / NES 2.0 文件头解析。
 *
 * 头部布局（16 字节）：
 *   0-3  magic 'NES\x1a'
 *   4    PRG ROM 单元数（×16KB）
 *   5    CHR ROM 单元数（×8KB），0 表示用 CHR RAM
 *   6    bit0 镜像（0 水平 / 1 垂直）、bit1 电池、bit2 trainer、bit3 四屏、bit4-7 mapper 低 4 位
 *   7    bit0 VS、bit1 PlayChoice、bit2-3 == 2 表示 NES 2.0、bit4-7 mapper 高 4 位
 *   8    NES 2.0：低 4 位 = mapper bit8-11，高 4 位 = submapper
 *   9    NES 2.0：低 4 位 = PRG 单元数高 4 位，高 4 位 = CHR 单元数高 4 位
 */
import type { Mirroring, RomFormat, RomInfo } from '@/types/game'

import { crc32 } from './crc32'

const MAGIC = [0x4e, 0x45, 0x53, 0x1a] as const
const HEADER_SIZE = 16
const TRAINER_SIZE = 512
const PRG_UNIT = 16 * 1024
const CHR_UNIT = 8 * 1024

function hasInesMagic(bytes: Uint8Array): boolean {
  if (bytes.length < HEADER_SIZE) return false
  return MAGIC.every((byte, i) => bytes[i] === byte)
}

/**
 * 解析 ROM。非 iNES 的裸数据归为 format: 'raw'（FDS / UNIF 等也走这条路），
 * 数据明显不成立时抛 Error。
 */
export function parseRom(buffer: ArrayBuffer): RomInfo {
  const bytes = new Uint8Array(buffer)

  if (bytes.length === 0) {
    throw new Error('文件为空')
  }
  if (bytes.length < 1024) {
    throw new Error(`文件过小（${bytes.length} 字节），不像是 FC 卡带数据`)
  }

  if (!hasInesMagic(bytes)) {
    // 裸 ROM：没有文件头可读，只能给出体积推算，CRC 对整个文件计算
    return {
      crc32: crc32(bytes),
      sizeBytes: bytes.length,
      mapper: 0,
      prgBanks: Math.max(1, Math.ceil(bytes.length / PRG_UNIT)),
      chrBanks: 0,
      mirroring: 'horizontal',
      hasBattery: false,
      hasTrainer: false,
      format: 'raw',
    }
  }

  const flags6 = bytes[6]
  const flags7 = bytes[7]
  const isNes2 = ((flags7 >> 2) & 0x03) === 2
  const format: RomFormat = isNes2 ? 'nes2' : 'ines'

  let prgBanks = bytes[4]
  let chrBanks = bytes[5]
  let mapper = ((flags7 & 0xf0) | (flags6 >> 4)) >>> 0

  if (isNes2) {
    mapper |= (bytes[8] & 0x0f) << 8
    const prgHigh = bytes[9] & 0x0f
    const chrHigh = (bytes[9] >> 4) & 0x0f
    // 高 4 位为 0xF 时是指数计法（极少见），此处保守地不做换算，直接沿用低 8 位
    if (prgHigh !== 0x0f) prgBanks |= prgHigh << 8
    if (chrHigh !== 0x0f) chrBanks |= chrHigh << 8
  }

  const hasTrainer = (flags6 & 0x04) !== 0
  const hasBattery = (flags6 & 0x02) !== 0
  const mirroring: Mirroring =
    (flags6 & 0x08) !== 0 ? 'four-screen' : (flags6 & 0x01) !== 0 ? 'vertical' : 'horizontal'

  if (prgBanks === 0) {
    throw new Error('iNES 头声明 PRG 大小为 0，文件已损坏')
  }

  const dataStart = HEADER_SIZE + (hasTrainer ? TRAINER_SIZE : 0)
  const expected = dataStart + prgBanks * PRG_UNIT + chrBanks * CHR_UNIT

  if (bytes.length < dataStart + PRG_UNIT) {
    throw new Error('ROM 数据不足一个 PRG 单元，文件已损坏')
  }

  // 允许尾部多出数据（某些转储会附加校验信息），但不足声明长度时按实际长度算 CRC
  const dataEnd = Math.min(expected, bytes.length)
  const payload = bytes.subarray(dataStart, dataEnd)

  return {
    crc32: crc32(payload),
    sizeBytes: bytes.length,
    mapper,
    prgBanks,
    chrBanks,
    mirroring,
    hasBattery,
    hasTrainer,
    format,
  }
}
