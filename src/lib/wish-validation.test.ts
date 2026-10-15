import { describe, expect, it } from 'vitest'
import {
  MESSAGE_MAX,
  NAME_MAX,
  cleanText,
  containsProfanity,
  validateWish,
} from './wish-validation'

describe('cleanText', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanText('  Chúc   mừng  ')).toBe('Chúc mừng')
  })

  it('turns newlines into spaces instead of gluing words together', () => {
    expect(cleanText('Chúc mừng\nhạnh phúc')).toBe('Chúc mừng hạnh phúc')
  })

  it('removes control, zero-width and bidi override characters', () => {
    expect(cleanText('A\u0000B​C‮D')).toBe('ABCD')
  })

  it('normalizes decomposed Vietnamese to NFC', () => {
    expect(cleanText('ệ')).toBe('ệ')
  })
})

describe('containsProfanity', () => {
  it('matches whole words only', () => {
    expect(containsProfanity('đm')).toBe(true)
    expect(containsProfanity('Thế này là VCL luôn')).toBe(true)
    expect(containsProfanity('what the fuck!')).toBe(true)
  })

  it('does not flag ordinary words that contain a listed word', () => {
    expect(containsProfanity('Chúc hai bạn hạnh phúc')).toBe(false)
    expect(containsProfanity('Chúc ngủ ngon, lớn nhanh')).toBe(false)
    expect(containsProfanity('classic dmitri')).toBe(false)
  })

  it('looks through punctuation', () => {
    expect(containsProfanity('xin chào, đm...')).toBe(true)
  })
})

describe('validateWish', () => {
  it('accepts and cleans a normal wish', () => {
    expect(validateWish('  Thu Hà ', 'Chúc hai bạn trăm năm hạnh phúc!')).toEqual({
      ok: true,
      name: 'Thu Hà',
      message: 'Chúc hai bạn trăm năm hạnh phúc!',
    })
  })

  it('requires a name', () => {
    expect(validateWish('   ', 'Chúc mừng')).toEqual({ ok: false, error: 'name_required' })
  })

  it('limits the name length by characters', () => {
    expect(validateWish('a'.repeat(NAME_MAX), 'Chúc mừng').ok).toBe(true)
    expect(validateWish('a'.repeat(NAME_MAX + 1), 'Chúc mừng')).toEqual({
      ok: false,
      error: 'name_too_long',
    })
  })

  it('limits the message length', () => {
    expect(validateWish('An', 'a'.repeat(MESSAGE_MAX)).ok).toBe(true)
    expect(validateWish('An', 'a'.repeat(MESSAGE_MAX + 1))).toEqual({
      ok: false,
      error: 'message_too_long',
    })
    expect(validateWish('An', 'a')).toEqual({ ok: false, error: 'message_too_short' })
  })

  it('rejects profanity in name or message', () => {
    expect(validateWish('An', 'đm hay quá')).toEqual({ ok: false, error: 'profanity' })
    expect(validateWish('vcl', 'Chúc mừng')).toEqual({ ok: false, error: 'profanity' })
  })
})
