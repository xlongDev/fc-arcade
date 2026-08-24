import { describe, expect, it } from 'vitest'

import { parseFileName } from '../filename'

describe('parseFileName', () => {
  it('parses GoodNES region + verified flag', () => {
    const r = parseFileName('Contra (U) [!].nes')
    expect(r.title).toBe('Contra')
    expect(r.region).toBe('US')
    expect(r.flags).toContain('verified')
  })

  it('parses No-Intro full region + rev', () => {
    const r = parseFileName('Legend of Zelda, The (USA) (Rev 1).nes')
    expect(r.title).toBe('The Legend of Zelda')
    expect(r.region).toBe('US')
    expect(r.flags).toContain('rev:1')
  })

  it('detects Chinese translation and sets CN region', () => {
    const r = parseFileName('Rockman 2 (J) [T+Chi_Flame].nes')
    expect(r.region).toBe('CN')
    expect(r.flags).toContain('translated-zh')
  })

  it('extracts 4-digit year', () => {
    const r = parseFileName('Metroid (USA) (1991).nes')
    expect(r.year).toBe(1991)
  })

  it('handles multi-region as World', () => {
    const r = parseFileName('Castlevania (USA, Europe).nes')
    expect(r.region).toBe('World')
  })

  it('cleans underscores and extensions', () => {
    const r = parseFileName('Super_Mario_Bros.nes')
    expect(r.title).toBe('Super Mario Bros')
  })

  it('marks pirate / hack / bad brackets', () => {
    expect(parseFileName('Game (U) [p1].nes').flags).toContain('pirate')
    expect(parseFileName('Game (U) [h1].nes').flags).toContain('hack')
    expect(parseFileName('Game (U) [b3].nes').flags).toContain('bad')
  })
})
