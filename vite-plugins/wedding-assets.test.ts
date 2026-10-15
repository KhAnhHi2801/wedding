import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listImageFiles, readImages } from './wedding-assets'

let publicDir: string

async function addImage(folder: string, name: string, width = 40, height = 60, format: 'webp' | 'jpeg' | 'png' = 'webp') {
  const dir = join(publicDir, 'assets', folder)
  mkdirSync(dir, { recursive: true })
  const data = await sharp({ create: { width, height, channels: 3, background: '#e88' } })[format]().toBuffer()
  writeFileSync(join(dir, name), data)
}

beforeEach(() => {
  publicDir = mkdtempSync(join(tmpdir(), 'wedding-assets-'))
})
afterEach(() => rmSync(publicDir, { recursive: true, force: true }))

describe('listImageFiles', () => {
  it('returns nothing for a folder that does not exist', () => {
    expect(listImageFiles(join(publicDir, 'nope'))).toEqual([])
  })

  it('keeps only image files and ignores hidden and non-image files', async () => {
    await addImage('photos', 'a.webp')
    await addImage('photos', 'b.JPG', 10, 10, 'jpeg')
    await addImage('photos', 'c.png', 10, 10, 'png')
    writeFileSync(join(publicDir, 'assets', 'photos', 'notes.txt'), 'x')
    writeFileSync(join(publicDir, 'assets', 'photos', '.DS_Store'), 'x')
    writeFileSync(join(publicDir, 'assets', 'photos', 'a.webp.bak'), 'x')
    expect(listImageFiles(join(publicDir, 'assets', 'photos'))).toEqual(['a.webp', 'b.JPG', 'c.png'])
  })

  it('sorts by natural number order, not character order', async () => {
    for (const name of ['photo-10.webp', 'photo-2.webp', 'photo-1.webp', 'Photo-3.webp']) await addImage('photos', name)
    expect(listImageFiles(join(publicDir, 'assets', 'photos'))).toEqual([
      'photo-1.webp',
      'photo-2.webp',
      'Photo-3.webp',
      'photo-10.webp',
    ])
  })
})

describe('readImages', () => {
  it('reads the real dimensions and builds URL-safe paths for awkward file names', async () => {
    await addImage('photos', 'images (2).webp', 30, 50)
    await addImage('photos', 'Ảnh cưới #1.webp', 80, 40)
    const photos = await readImages(publicDir, 'photos', 'Ảnh cưới')
    const byName = Object.fromEntries(photos.map((p) => [decodeURIComponent(p.src.split('/').pop()!), p]))
    expect(byName['images (2).webp']).toMatchObject({ width: 30, height: 50 })
    expect(byName['Ảnh cưới #1.webp']).toMatchObject({ width: 80, height: 40 })
    // khoảng trắng và ký tự đặc biệt phải được mã hóa để trình duyệt tải được
    for (const p of photos) {
      expect(p.src.startsWith('/assets/photos/')).toBe(true)
      expect(p.src).not.toMatch(/[ #]/)
    }
  })

  it('numbers the alt text in display order', async () => {
    await addImage('photos', '1.webp')
    await addImage('photos', '2.webp')
    expect((await readImages(publicDir, 'photos', 'Ảnh cưới')).map((p) => p.alt)).toEqual(['Ảnh cưới 1', 'Ảnh cưới 2'])
  })

  it('returns an empty list for an empty or missing folder', async () => {
    expect(await readImages(publicDir, 'photos', 'x')).toEqual([])
  })

  it('warns about a large image but still lists it', async () => {
    await addImage('photos', 'big.png', 3000, 2000, 'png')
    const warn = vi.fn()
    const photos = await readImages(publicDir, 'photos', 'x', warn)
    expect(photos).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('big.png'))
  })

  it('does not warn about a small image', async () => {
    await addImage('photos', 'small.webp', 400, 500)
    const warn = vi.fn()
    await readImages(publicDir, 'photos', 'x', warn)
    expect(warn).not.toHaveBeenCalled()
  })
})
