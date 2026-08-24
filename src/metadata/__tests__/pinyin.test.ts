import { describe, expect, it } from 'vitest'

import { hasCjk, pinyinInitials } from '../pinyin'

describe('pinyinInitials', () => {
  it('maps common titles to first letters', () => {
    expect(pinyinInitials('魂斗罗')).toBe('hdl')
    expect(pinyinInitials('超级马里奥')).toBe('cjma')
  })

  it('skips non-CJK characters', () => {
    expect(pinyinInitials('魂斗罗 Contra')).toBe('hdl')
    expect(pinyinInitials('abc')).toBe('')
  })

  it('returns empty for empty input', () => {
    expect(pinyinInitials('')).toBe('')
  })

  it('silently skips unlisted rare characters', () => {
    expect(pinyinInitials('龘')).toBe('')
  })
})

describe('hasCjk', () => {
  it('detects Chinese characters', () => {
    expect(hasCjk('魂斗罗')).toBe(true)
    expect(hasCjk('Contra')).toBe(false)
    expect(hasCjk('')).toBe(false)
  })
})
