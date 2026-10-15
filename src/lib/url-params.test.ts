import { describe, expect, it } from 'vitest'
import { parseInvite } from './url-params'

describe('parseInvite', () => {
  it('returns no side and no guest when params are missing', () => {
    expect(parseInvite('')).toEqual({ side: null, guestName: null })
  })

  it('accepts nha=trai and nha=gai case-insensitively', () => {
    expect(parseInvite('?nha=trai').side).toBe('trai')
    expect(parseInvite('?nha=GAI').side).toBe('gai')
    expect(parseInvite('?nha=%20Trai%20').side).toBe('trai')
  })

  it('ignores invalid nha values', () => {
    expect(parseInvite('?nha=xyz').side).toBeNull()
    expect(parseInvite('?nha=').side).toBeNull()
  })

  it('decodes guest name including + as space', () => {
    expect(parseInvite('?khach=Anh+Minh').guestName).toBe('Anh Minh')
    expect(parseInvite('?khach=Anh%20Minh').guestName).toBe('Anh Minh')
  })

  it('keeps markup as plain text (React escapes it on render)', () => {
    expect(parseInvite('?khach=%3Cscript%3E').guestName).toBe('<script>')
  })

  it('strips control characters and collapses whitespace', () => {
    expect(parseInvite('?khach=A%00B%0A%20%20C').guestName).toBe('AB C')
  })

  it('strips zero-width and bidi override characters', () => {
    // U+200B zero-width space, U+202E right-to-left override, U+0085 C1 control
    expect(parseInvite('?khach=A%E2%80%8BB%E2%80%AEC%C2%85D').guestName).toBe('ABCD')
  })

  it('normalizes decomposed Vietnamese letters before clipping', () => {
    // "ệ" as e + combining circumflex + combining dot below (NFD) -> single NFC code point
    const nfd = 'ệ'
    const name = parseInvite(`?khach=${encodeURIComponent(nfd.repeat(40))}`).guestName
    expect(name).toBe('ệ'.repeat(40))
  })

  it('clips long names to 40 characters', () => {
    const long = 'a'.repeat(100)
    expect(parseInvite(`?khach=${long}`).guestName).toHaveLength(40)
  })

  it('treats a blank name as no guest', () => {
    expect(parseInvite('?khach=%20%20').guestName).toBeNull()
  })

  it('combines both params', () => {
    expect(parseInvite('?nha=gai&khach=Chi+Lan')).toEqual({ side: 'gai', guestName: 'Chi Lan' })
  })
})
