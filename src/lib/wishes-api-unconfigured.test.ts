import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWishes, submitWish } from './wishes-api'

vi.mock('../config/env', () => ({ wishesEndpoint: '' }))

describe('without VITE_WISHES_ENDPOINT', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fails with not_configured and never calls the network when reading', async () => {
    await expect(fetchWishes()).rejects.toMatchObject({ code: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails with not_configured and never calls the network when sending', async () => {
    await expect(
      submitWish({ name: 'An', message: 'Chúc mừng', token: 't', elapsedMs: 5000, website: '', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
