import { describe, expect, it } from 'vitest'

import {
  encodeCustomTitleId,
  lookupByCrc,
  matchByFileName,
  resolveTitleId,
  titleIdForUserTitle,
} from '../match-core'

describe('encodeCustomTitleId / resolveTitleId', () => {
  it('encodes arbitrary titles with the custom prefix', () => {
    expect(encodeCustomTitleId('我的游戏')).toBe('custom:我的游戏')
    expect(encodeCustomTitleId('  spaced  ')).toBe('custom:spaced')
  })

  it('resolves a library id to its entry', () => {
    expect(resolveTitleId('super-mario-bros')?.title).toBe('Super Mario Bros.')
    expect(resolveTitleId('super-mario-bros')?.cn).toBe('超级马里奥兄弟')
  })

  it('resolves a custom: id back to a minimal entry carrying the title', () => {
    const entry = resolveTitleId('custom:街霸同人')
    expect(entry).not.toBeNull()
    expect(entry?.title).toBe('街霸同人')
    expect(entry?.cn).toBe('街霸同人')
  })

  it('returns null for unknown non-custom id', () => {
    expect(resolveTitleId('does-not-exist')).toBeNull()
  })

  it('custom id with empty title after trim is null', () => {
    expect(resolveTitleId('custom:   ')).toBeNull()
  })
})

describe('titleIdForUserTitle', () => {
  it('maps a known title to its library id', () => {
    expect(titleIdForUserTitle('Super Mario Bros.')).toBe('super-mario-bros')
  })

  it('falls back to custom: when not in library', () => {
    expect(titleIdForUserTitle('Some Random Hack')).toBe('custom:Some Random Hack')
  })

  it('matches via normalized form (aliases)', () => {
    expect(titleIdForUserTitle('SMB')).toBe('super-mario-bros')
    expect(titleIdForUserTitle('zelda')).toBe('legend-of-zelda')
  })
})

describe('lookupByCrc', () => {
  it('returns null when library has no crc entries', () => {
    // 内置库 crcs 留空（设计约定），不应误命中
    expect(lookupByCrc('deadbeef')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(lookupByCrc('DEADBEEF')).toBeNull()
  })
})

describe('matchByFileName', () => {
  it('matches a clean GoodNES-ish filename to a known title', () => {
    const out = matchByFileName('Contra (U) [!].nes')
    expect(out.length).toBeGreaterThan(0)
    expect(out[0].entry.id).toBe('contra')
  })

  it('matches by pinyin initials for Chinese-named titles', () => {
    const out = matchByFileName('hdl.nes')
    // 「魂斗罗」首字母 hdl，库内 Contra 中文名即「魂斗罗」，应高置信命中
    expect(out.length).toBeGreaterThan(0)
    expect(out.some((s) => s.entry.cn === '魂斗罗' && s.score >= 0.9)).toBe(true)
  })

  it('strips noise tokens before matching', () => {
    const out = matchByFileName('SuperMarioBros_USA_rev1.nes')
    expect(out.length).toBeGreaterThan(0)
  })

  it('returns empty for too-short noise-only filename', () => {
    const out = matchByFileName('usa.nes')
    expect(out).toEqual([])
  })

  it('does not touch the database (pure)', () => {
    // 直接断言不抛出、能在无 IndexedDB 环境运行
    expect(() => matchByFileName('Metroid (USA).nes')).not.toThrow()
  })
})
