import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PAGE_SIZE,
  WishApiError,
  fetchWishes,
  getClientToken,
  parseSubmitResult,
  parseWishesPage,
  submitWish,
} from './wishes-api'

vi.mock('../config/env', () => ({ wishesEndpoint: 'https://example.test/exec' }))

const okResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response

const payload = { name: 'An', message: 'Chúc mừng', token: 't', elapsedMs: 5000, website: '', requestId: 'req-1' }

describe('parseWishesPage', () => {
  it('keeps only well-formed wishes and strips unknown fields', () => {
    const page = parseWishesPage({
      ok: true,
      items: [
        { id: '1', createdAt: 'x', name: 'An', message: 'Hi', extra: '<script>' },
        { id: 2, createdAt: 'x', name: 'Bad', message: 'wrong id type' },
        null,
        'oops',
      ],
      nextCursor: '12',
    })
    expect(page).toEqual({
      items: [{ id: '1', createdAt: 'x', name: 'An', message: 'Hi' }],
      nextCursor: '12',
    })
  })

  it('treats a missing or non-string cursor as the end', () => {
    expect(parseWishesPage({ ok: true, items: [], nextCursor: null }).nextCursor).toBeNull()
    expect(parseWishesPage({ ok: true, items: [], nextCursor: 5 }).nextCursor).toBeNull()
  })

  it('rejects a response that is not ok', () => {
    expect(() => parseWishesPage({ ok: false, error: 'server' })).toThrow(WishApiError)
    expect(() => parseWishesPage('<html>')).toThrow(WishApiError)
    expect(() => parseWishesPage({ ok: true })).toThrow(WishApiError)
  })
})

describe('parseSubmitResult', () => {
  it('parses success and hidden status', () => {
    expect(parseSubmitResult({ ok: true, id: 'abc', status: 'visible' })).toEqual({ id: 'abc', status: 'visible' })
    expect(parseSubmitResult({ ok: true, id: '', status: 'hidden' })).toEqual({ id: '', status: 'hidden' })
  })

  it('maps server error codes', () => {
    const code = (data: unknown) => {
      try {
        parseSubmitResult(data)
      } catch (error) {
        return (error as WishApiError).code
      }
    }
    expect(code({ ok: false, error: 'rate_limited' })).toBe('rate_limited')
    expect(code({ ok: false, error: 'too_fast' })).toBe('too_fast')
    expect(code({ ok: false, error: 'server' })).toBe('server')
    expect(code({ ok: false, error: 'name_required' })).toBe('rejected')
    expect(code(null)).toBe('server')
  })
})

describe('network calls', () => {
  const fetchMock = vi.fn()
  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('requests the first page with the page size and no cursor', async () => {
    fetchMock.mockResolvedValue(okResponse({ ok: true, items: [], nextCursor: null }))
    await fetchWishes()
    expect(fetchMock.mock.calls[0][0]).toBe(`https://example.test/exec?limit=${PAGE_SIZE}`)
  })

  it('passes the cursor as `before`', async () => {
    fetchMock.mockResolvedValue(okResponse({ ok: true, items: [], nextCursor: null }))
    await fetchWishes('37')
    expect(fetchMock.mock.calls[0][0]).toBe(`https://example.test/exec?limit=${PAGE_SIZE}&before=37`)
  })

  it('posts text/plain JSON so the browser sends no preflight', async () => {
    fetchMock.mockResolvedValue(okResponse({ ok: true, id: 'abc', status: 'visible' }))
    const result = await submitWish(payload)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toMatch(/^text\/plain/)
    expect(JSON.parse(init.body)).toEqual(payload)
    expect(result).toEqual({ id: 'abc', status: 'visible' })
  })

  it('maps network failures, bad JSON and HTTP errors to distinct codes', async () => {
    const codeOf = async () => {
      try {
        await fetchWishes()
      } catch (error) {
        return (error as WishApiError).code
      }
    }
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await codeOf()).toBe('network')
    fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('bad json') } })
    expect(await codeOf()).toBe('server')
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    expect(await codeOf()).toBe('server')
  })

  it('maps an aborted request to a timeout', async () => {
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'))
    await expect(fetchWishes()).rejects.toMatchObject({ code: 'timeout' })
  })
})

describe('getClientToken', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns a stable token even when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const first = getClientToken()
    expect(first).toBeTruthy()
    expect(getClientToken()).toBe(first)
  })

  it('persists the token in localStorage when available', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    })
    const token = getClientToken()
    expect(store.get('wishes.token')).toBe(token)
    expect(getClientToken()).toBe(token)
  })
})
