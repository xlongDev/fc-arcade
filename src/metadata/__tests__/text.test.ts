import { describe, expect, it } from 'vitest'

import {
  buildSearchText,
  diceCoefficient,
  normalizeTitle,
  restoreLeadingArticle,
} from '../text'

describe('normalizeTitle', () => {
  it('lowercases, drops articles and punctuation', () => {
    expect(normalizeTitle('The Legend of Zelda II')).toBe('legendofzelda2')
  })

  it('maps roman numerals ii..xii', () => {
    expect(normalizeTitle('Mega Man IV')).toBe('megaman4')
    expect(normalizeTitle('Final Fantasy VI')).toBe('finalfantasy6')
  })

  it('strips diacritics and full-width chars', () => {
    // `the` 是冠词，被 normalizeTitle 刻意丢弃（源码正确行为）
    expect(normalizeTitle('Sónic the Hedgehog')).toBe('sonichedgehog')
    expect(normalizeTitle('ＭＡＲＩＯ')).toBe('mario')
  })

  it('returns empty for empty input', () => {
    expect(normalizeTitle('')).toBe('')
  })

  it('does not collapse to empty when only articles', () => {
    expect(normalizeTitle('The')).toBe('the')
  })
})

describe('diceCoefficient', () => {
  it('is 1 for identical strings', () => {
    expect(diceCoefficient('mario', 'mario')).toBe(1)
  })

  it('is 0 for empty input', () => {
    expect(diceCoefficient('', 'x')).toBe(0)
  })

  it('is higher for more similar strings', () => {
    const a = diceCoefficient('contra', 'contraforce')
    const b = diceCoefficient('contra', 'zelda')
    expect(a).toBeGreaterThan(b)
  })
})

describe('restoreLeadingArticle', () => {
  it('reorders No-Intro trailing article', () => {
    expect(restoreLeadingArticle('Legend of Zelda, The')).toBe('The Legend of Zelda')
    expect(restoreLeadingArticle('Castlevania, The')).toBe('The Castlevania')
  })

  it('leaves normal titles untouched', () => {
    expect(restoreLeadingArticle('Super Mario Bros')).toBe('Super Mario Bros')
  })
})

describe('buildSearchText', () => {
  it('joins title, normalized, alias and pinyin initials', () => {
    const text = buildSearchText({
      title: 'Contra',
      titleAlias: '魂斗罗',
      fileName: 'Contra (U).nes',
      aliases: ['Probotector'],
    })
    expect(text).toContain('contra')
    expect(text).toContain('魂斗罗')
    expect(text).toContain('hdl') // 魂斗罗 pinyin initials
    expect(text).toContain('probotector')
  })

  it('dedupes and lowercases', () => {
    const text = buildSearchText({ title: 'METROID', titleAlias: null, fileName: 'metroid' })
    expect(text).toBe('metroid')
  })
})
