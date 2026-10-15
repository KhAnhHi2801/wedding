import { describe, expect, it } from 'vitest'
import type { Wish } from './wishes-api'
import { appendPage, dedupeById, mergeFirstPage } from './wishes-merge'

const wish = (id: string, name = id): Wish => ({ id, createdAt: '2026-12-01T00:00:00Z', name, message: `msg ${id}` })

describe('dedupeById', () => {
  it('keeps the first occurrence and the order', () => {
    expect(dedupeById([wish('a'), wish('b'), wish('a', 'dup')]).map((w) => w.name)).toEqual(['a', 'b'])
  })
})

describe('mergeFirstPage', () => {
  it('puts pending wishes before the freshly fetched page', () => {
    const merged = mergeFirstPage([wish('s2'), wish('s1')], [wish('local-1')])
    expect(merged.map((w) => w.id)).toEqual(['local-1', 's2', 's1'])
  })

  it('does not duplicate a wish that the server already returned', () => {
    const merged = mergeFirstPage([wish('s1')], [wish('s1')])
    expect(merged).toHaveLength(1)
  })

  it('drops stale cached items that the server no longer returns', () => {
    expect(mergeFirstPage([wish('s2')], []).map((w) => w.id)).toEqual(['s2'])
  })
})

describe('appendPage', () => {
  it('appends older wishes and skips ones already shown', () => {
    const merged = appendPage([wish('a'), wish('b')], [wish('b'), wish('c')])
    expect(merged.map((w) => w.id)).toEqual(['a', 'b', 'c'])
  })
})
