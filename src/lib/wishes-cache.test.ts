import { afterEach, describe, expect, it, vi } from 'vitest'
import { readCachedWishes, writeCachedWishes } from './wishes-cache'

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  })
  return store
}

const wish = (id: string) => ({ id, createdAt: 'x', name: 'An', message: 'Hi' })

afterEach(() => vi.unstubAllGlobals())

describe('wishes cache', () => {
  it('round-trips the first page', () => {
    stubStorage()
    writeCachedWishes([wish('1'), wish('2')])
    expect(readCachedWishes()).toEqual([wish('1'), wish('2')])
  })

  it('returns nothing when the cache is empty', () => {
    stubStorage()
    expect(readCachedWishes()).toEqual([])
  })

  it('ignores corrupt JSON and malformed entries', () => {
    stubStorage({ 'wishes.firstPage.v1': '{not json' })
    expect(readCachedWishes()).toEqual([])
    stubStorage({ 'wishes.firstPage.v1': JSON.stringify([wish('1'), { id: 5 }, null]) })
    expect(readCachedWishes()).toEqual([wish('1')])
  })

  it('keeps at most 50 cached wishes', () => {
    const store = stubStorage()
    writeCachedWishes(Array.from({ length: 80 }, (_, i) => wish(String(i))))
    expect(JSON.parse(store.get('wishes.firstPage.v1')!)).toHaveLength(50)
  })

  it('does not throw when localStorage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readCachedWishes()).toEqual([])
    expect(() => writeCachedWishes([wish('1')])).not.toThrow()
  })
})
