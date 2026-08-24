import { describe, expect, it } from 'vitest'

import { crc32 } from '../crc32'
import { parseRom } from '../ines'

/** 造一个最小合法 iNES 文件：16 字节头 + PRG/CHR 单元 + （可选）trainer 512 字节 */
function makeInes(overrides: Partial<{ flags6: number; flags7: number; prg: number; chr: number }> = {}) {
  const { flags6 = 0x00, flags7 = 0x00, prg = 1, chr = 0 } = overrides
  const hasTrainer = (flags6 & 0x04) !== 0
  const trainSize = hasTrainer ? 512 : 0
  // prg=0 的特殊用例也要给够 ≥1024 正文，才能越过「文件过小」检查走到 PRG=0 校验
  const bodyLen = Math.max(1024, prg * 16 * 1024 + chr * 8 * 1024)
  const header = new Uint8Array(16)
  header[0] = 0x4e // N
  header[1] = 0x45 // E
  header[2] = 0x53 // S
  header[3] = 0x1a // \x1a
  header[4] = prg
  header[5] = chr
  header[6] = flags6
  header[7] = flags7
  const body = new Uint8Array(trainSize + bodyLen)
  // 填点非零数据，CRC 才有意义
  for (let i = 0; i < body.length; i += 997) body[i] = (i * 31) & 0xff
  const out = new Uint8Array(16 + body.length)
  out.set(header, 0)
  out.set(body, 16)
  return out.buffer
}

describe('parseRom', () => {
  it('parses a plain iNES header', () => {
    const info = parseRom(makeInes())
    expect(info.format).toBe('ines')
    expect(info.prgBanks).toBe(1)
    expect(info.chrBanks).toBe(0)
    expect(info.mapper).toBe(0)
    expect(info.mirroring).toBe('horizontal')
    expect(info.hasBattery).toBe(false)
  })

  it('reads mapper from flags6 high nibble + flags7 high nibble', () => {
    // mapper = ((flags7 & 0xf0) | (flags6 >> 4))
    // flags6=0x10 → 0x10>>4 = 1；flags7=0x20 → 0x20；1 | 0x20 = 0x21 = 33
    const info = parseRom(makeInes({ flags6: 0x10, flags7: 0x20 }))
    expect(info.mapper).toBe(0x21)
  })

  it('detects NES 2.0 when flags7 bits 2-3 == 2', () => {
    const info = parseRom(makeInes({ flags7: 0x08 }))
    expect(info.format).toBe('nes2')
  })

  it('reads mirroring bits', () => {
    expect(parseRom(makeInes({ flags6: 0x01 })).mirroring).toBe('vertical')
    expect(parseRom(makeInes({ flags6: 0x08 })).mirroring).toBe('four-screen')
    expect(parseRom(makeInes({ flags6: 0x00 })).mirroring).toBe('horizontal')
  })

  it('detects battery and trainer flags', () => {
    const info = parseRom(makeInes({ flags6: 0x02 | 0x04 }))
    expect(info.hasBattery).toBe(true)
    expect(info.hasTrainer).toBe(true)
  })

  it('treats non-magic bytes as raw ROM', () => {
    const bytes = new Uint8Array(40 * 1024)
    bytes.fill(0x42)
    const info = parseRom(bytes.buffer)
    expect(info.format).toBe('raw')
    expect(info.crc32).toBe(crc32(bytes))
  })

  it('throws on empty file', () => {
    expect(() => parseRom(new ArrayBuffer(0))).toThrow()
  })

  it('throws when PRG bank count is 0', () => {
    expect(() => parseRom(makeInes({ prg: 0 }))).toThrow(/PRG/)
  })
})
