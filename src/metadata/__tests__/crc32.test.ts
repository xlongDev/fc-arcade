import { describe, expect, it } from 'vitest'

import { crc32 } from '../crc32'

/** 已知向量：CRC-32(IEEE) 的公开校验值 */
const CASES: Array<[string, string]> = [
  ['', '00000000'],
  ['a', 'e8b7be43'],
  ['abc', '352441c2'],
  ['123456789', 'cbf43926'],
  ['The quick brown fox jumps over the lazy dog', '414fa339'],
]

describe('crc32', () => {
  it('matches known vectors', () => {
    for (const [input, expected] of CASES) {
      const bytes = new TextEncoder().encode(input)
      expect(crc32(bytes)).toBe(expected)
    }
  })

  it('is stable and lowercase hex of length 8', () => {
    const bytes = new TextEncoder().encode('fc-arcade')
    const out = crc32(bytes)
    expect(out).toMatch(/^[0-9a-f]{8}$/)
    expect(crc32(bytes)).toBe(out)
  })

  it('differs for one-bit changes', () => {
    expect(crc32(new TextEncoder().encode('abc'))).not.toBe(
      crc32(new TextEncoder().encode('abd')),
    )
  })
})
