// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WishApiError, type Wish, type WishesPage } from '../lib/wishes-api'
import { useWishes } from './use-wishes'

const api = vi.hoisted(() => ({ fetchWishes: vi.fn(), submitWish: vi.fn() }))
vi.mock('../lib/wishes-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/wishes-api')>()),
  fetchWishes: api.fetchWishes,
  submitWish: api.submitWish,
}))

const wish = (id: string, name = `name-${id}`): Wish => ({ id, createdAt: '2026-12-01T00:00:00Z', name, message: `msg ${id}` })
const page = (items: Wish[], nextCursor: string | null = null): WishesPage => ({ items, nextCursor })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type Hook = ReturnType<typeof useWishes>
let current: Hook
let root: Root

function Probe() {
  const result = useWishes()
  useEffect(() => {
    current = result
  })
  return null
}

async function mount() {
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(<Probe />))
}

const sendInput = { name: 'An', message: 'Chúc mừng', elapsedMs: 5000, website: '', requestId: 'req-1' }
const ids = () => current.items.map((w) => w.id)

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  api.fetchWishes.mockReset()
  api.submitWish.mockReset()
})

afterEach(async () => {
  await act(async () => root.unmount())
})

describe('loading', () => {
  it('shows the first page and its cursor after loading', async () => {
    api.fetchWishes.mockResolvedValue(page([wish('b'), wish('a')], '2'))
    await mount()
    expect(current.status).toBe('ready')
    expect(ids()).toEqual(['b', 'a'])
    expect(current.hasMore).toBe(true)
  })

  it('reports not_configured when there is nothing to show', async () => {
    api.fetchWishes.mockRejectedValue(new WishApiError('not_configured'))
    await mount()
    expect(current.status).toBe('error')
    expect(current.errorCode).toBe('not_configured')
  })

  it('keeps cached wishes visible when the refresh fails', async () => {
    localStorage.setItem('wishes.firstPage.v1', JSON.stringify([wish('cached')]))
    api.fetchWishes.mockRejectedValue(new WishApiError('network'))
    await mount()
    expect(current.status).toBe('ready')
    expect(ids()).toEqual(['cached'])
    expect(current.errorCode).toBe('network')
  })

  it('clears the error after a successful retry', async () => {
    api.fetchWishes.mockRejectedValueOnce(new WishApiError('network')).mockResolvedValueOnce(page([wish('a')]))
    await mount()
    expect(current.status).toBe('error')
    await act(async () => void (await current.reload()))
    expect(current.status).toBe('ready')
    expect(current.errorCode).toBeNull()
    expect(ids()).toEqual(['a'])
  })
})

describe('sending', () => {
  it('shows the wish immediately, then confirms it with the server id', async () => {
    api.fetchWishes.mockResolvedValue(page([wish('old')]))
    const submit = deferred<{ id: string; status: 'visible' }>()
    api.submitWish.mockReturnValue(submit.promise)
    await mount()

    let outcome: unknown
    let sending!: Promise<void>
    await act(async () => {
      sending = current.send(sendInput).then((r) => void (outcome = r))
    })
    expect(current.items[0].name).toBe('An')
    expect(current.items[0].id.startsWith('local-')).toBe(true)

    await act(async () => {
      submit.resolve({ id: 'server-1', status: 'visible' })
      await sending
    })
    expect(outcome).toEqual({ ok: true, hidden: false })
    expect(ids()).toEqual(['server-1', 'old'])
    expect(api.submitWish.mock.calls[0][0]).toMatchObject({ name: 'An', requestId: 'req-1', website: '' })
  })

  it('removes the wish and reports the error when sending fails', async () => {
    api.fetchWishes.mockResolvedValue(page([wish('old')]))
    api.submitWish.mockRejectedValue(new WishApiError('network'))
    await mount()
    let outcome: unknown
    await act(async () => void (outcome = await current.send(sendInput)))
    expect(outcome).toEqual({ ok: false, error: 'network' })
    expect(ids()).toEqual(['old'])
  })

  it('removes a wish held for moderation instead of showing it publicly', async () => {
    api.fetchWishes.mockResolvedValue(page([]))
    api.submitWish.mockResolvedValue({ id: 'x', status: 'hidden' })
    await mount()
    let outcome: unknown
    await act(async () => void (outcome = await current.send(sendInput)))
    expect(outcome).toEqual({ ok: true, hidden: true })
    expect(ids()).toEqual([])
  })

  it('rejects invalid input without calling the server or showing anything', async () => {
    api.fetchWishes.mockResolvedValue(page([]))
    await mount()
    let outcome: unknown
    await act(async () => void (outcome = await current.send({ ...sendInput, name: '  ' })))
    expect(outcome).toEqual({ ok: false, error: 'name_required' })
    expect(api.submitWish).not.toHaveBeenCalled()
    expect(ids()).toEqual([])
  })

  it('keeps the guest’s own wish when a load that started before sending finishes after it', async () => {
    const slowLoad = deferred<WishesPage>()
    api.fetchWishes.mockReturnValue(slowLoad.promise)
    api.submitWish.mockResolvedValue({ id: 'mine', status: 'visible' })
    await mount() // tải trang đầu vẫn đang chờ
    await act(async () => void (await current.send(sendInput)))
    expect(ids()).toEqual(['mine'])

    // Trang đầu về sau, được máy chủ tạo ra trước khi lời chúc được ghi nên không có "mine".
    await act(async () => slowLoad.resolve(page([wish('other')])))
    expect(ids()).toEqual(['mine', 'other'])

    // Khi máy chủ đã trả về lời chúc đó thì không bị nhân đôi.
    api.fetchWishes.mockResolvedValue(page([wish('mine'), wish('other')]))
    await act(async () => void (await current.reload()))
    expect(ids()).toEqual(['mine', 'other'])
  })
})

describe('loadMore', () => {
  it('appends older wishes and stops when the cursor ends', async () => {
    api.fetchWishes.mockResolvedValueOnce(page([wish('c'), wish('b')], '3')).mockResolvedValueOnce(page([wish('a')], null))
    await mount()
    await act(async () => void (await current.loadMore()))
    expect(ids()).toEqual(['c', 'b', 'a'])
    expect(current.hasMore).toBe(false)
    expect(api.fetchWishes).toHaveBeenLastCalledWith('3')
  })

  it('ignores a second call while one is in flight', async () => {
    const more = deferred<WishesPage>()
    api.fetchWishes.mockResolvedValueOnce(page([wish('b')], '2')).mockReturnValueOnce(more.promise)
    await mount()
    await act(async () => {
      void current.loadMore()
      void current.loadMore()
    })
    expect(api.fetchWishes).toHaveBeenCalledTimes(2) // 1 lần tải đầu + 1 lần loadMore
    await act(async () => more.resolve(page([wish('a')])))
    expect(ids()).toEqual(['b', 'a'])
  })

  it('flags an error and allows a retry', async () => {
    api.fetchWishes
      .mockResolvedValueOnce(page([wish('b')], '2'))
      .mockRejectedValueOnce(new WishApiError('network'))
      .mockResolvedValueOnce(page([wish('a')]))
    await mount()
    await act(async () => void (await current.loadMore()))
    expect(current.moreError).toBe(true)
    expect(current.hasMore).toBe(true)
    await act(async () => void (await current.loadMore()))
    expect(current.moreError).toBe(false)
    expect(ids()).toEqual(['b', 'a'])
  })
})
