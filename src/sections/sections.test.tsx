import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../app'
import { photos } from '../config/assets'
import { weddingConfig } from '../config/wedding-config'
import { EventsSection } from './events-section'
import { GiftSection } from './gift-section'
import { HeroSection } from './hero-section'
import { PhotosSection } from './photos-section'
import { ThreadGallery } from './thread-gallery'
import { WishesSection } from './wishes-section'

describe('EventsSection', () => {
  it('shows both sides when no side is chosen', () => {
    const html = renderToStaticMarkup(<EventsSection side={null} />)
    expect(html).toContain('Nhà trai')
    expect(html).toContain('Nhà gái')
  })

  it('shows only nhà trai events for side=trai', () => {
    const html = renderToStaticMarkup(<EventsSection side="trai" />)
    expect(html).toContain('Nhà trai')
    expect(html).not.toContain('Nhà gái')
    expect(html).toContain('Lễ thành hôn')
    expect(html).not.toContain('Lễ vu quy')
  })

  it('shows only nhà gái events for side=gai', () => {
    const html = renderToStaticMarkup(<EventsSection side="gai" />)
    expect(html).toContain('Lễ vu quy')
    expect(html).not.toContain('Lễ thành hôn')
  })

  it('offers directions for every event without loading a map iframe up front', () => {
    const html = renderToStaticMarkup(<EventsSection side={null} />)
    expect(html.match(/Chỉ đường<\/a>/g)).toHaveLength(weddingConfig.events.length)
    expect(html).not.toContain('<iframe')
  })
})

describe('GiftSection', () => {
  it('shows both bride and groom cards', () => {
    const html = renderToStaticMarkup(<GiftSection />)
    expect(html).toContain('Gửi yêu thương')
    expect(html).toContain(`Cô dâu · ${weddingConfig.couple.bride}`)
    expect(html).toContain(`Chú rể · ${weddingConfig.couple.groom}`)
    expect(html).toContain(weddingConfig.gift.bride.qrSrc)
    expect(html).toContain(weddingConfig.gift.groom.qrSrc)
    expect(html.match(/Chép số tài khoản/g)).toHaveLength(2)
  })

  it('does not use "quét mã" or "chuyển khoản" wording', () => {
    const html = renderToStaticMarkup(<GiftSection />)
    expect(html).not.toMatch(/quét mã|chuyển khoản/i)
  })
})

describe('ThreadGallery (red thread gallery)', () => {
  it('shows every configured photo as a button that opens the viewer, with size to avoid layout shift', () => {
    const html = renderToStaticMarkup(<ThreadGallery />)
    expect(html.match(/<figure/g)).toHaveLength(photos.length)
    expect(html.match(/aria-label="Xem ảnh \d+:/g)).toHaveLength(photos.length)
    // mỗi ảnh mang kích thước thật của nó (đọc từ file) để trình duyệt giữ chỗ đúng tỉ lệ
    for (const photo of photos) {
      expect(html).toContain(`width="${photo.width}"`)
      expect(html).toContain(`height="${photo.height}"`)
      expect(html).toContain(`src="${photo.src}"`)
    }
    expect(photos.length).toBeGreaterThan(0)
    expect(html).toContain('loading="lazy"')
  })

  it('shows all photos and the ending before any scroll logic runs (no hidden state without JS)', () => {
    const html = renderToStaticMarkup(<ThreadGallery />)
    expect(html).not.toContain('is-hidden')
    expect(html).toContain('Duyên lành đã định')
  })

  it('alternates the photos left and right so the thread can weave between them', () => {
    const html = renderToStaticMarkup(<ThreadGallery />)
    const sides = [...html.matchAll(/data-side="(left|right)"/g)].map((m) => m[1])
    expect(sides.slice(0, 4)).toEqual(['left', 'right', 'left', 'right'])
  })

  it('keeps the decorative thread out of the accessibility tree', () => {
    const html = renderToStaticMarkup(<ThreadGallery />)
    expect(html).toContain('id="photos"')
    expect(html).toContain('aria-labelledby="photos-title"')
  })
})

describe('PhotosSection chooser', () => {
  it('renders the thread gallery when WebGL is unavailable (server render / old device)', () => {
    const html = renderToStaticMarkup(<PhotosSection />)
    expect(html).toContain('id="photos"')
    expect(html).toContain('thread-gallery')
    expect(html).not.toContain('corridor-wrap')
  })

  it('shows every photo in the folder in the fallback', () => {
    const html = renderToStaticMarkup(<PhotosSection />)
    expect(html.match(/<figure/g)).toHaveLength(photos.length)
  })
})

describe('WishesSection', () => {
  it('opens in a loading state with a skeleton and a send button', () => {
    const html = renderToStaticMarkup(<WishesSection />)
    expect(html).toContain('id="wishes"')
    expect(html).toContain('Đang tải lời chúc')
    expect(html).toContain('Gửi lời chúc')
  })

  it('renders the form as a closed dialog with a hidden honeypot and length limits', () => {
    const html = renderToStaticMarkup(<WishesSection />)
    expect(html).toContain('<dialog')
    expect(html).not.toMatch(/<dialog[^>]*\sopen/)
    expect(html).toMatch(/name="website"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*name="website"/)
    expect(html).toContain('maxLength="40"')
    // Ô lời chúc không dùng maxLength (đếm UTF-16 làm emoji bị cắt sớm); giới hạn do bộ đếm và kiểm tra bảo đảm.
    expect(html).not.toContain('maxLength="300"')
    expect(html).toContain('0/300')
  })
})

describe('App wiring', () => {
  it('passes ?nha=gai and ?khach through to the page', () => {
    const html = renderToStaticMarkup(<App search="?nha=gai&khach=Chi+Lan" />)
    expect(html).toContain('Chi Lan')
    expect(html).toContain('Lễ vu quy')
    expect(html).not.toContain('Lễ thành hôn')
  })

  it('falls back to both sides and a generic invitation for an invalid ?nha', () => {
    const html = renderToStaticMarkup(<App search="?nha=xyz" />)
    expect(html).toContain('Nhà trai')
    expect(html).toContain('Nhà gái')
    expect(html).toContain('quý khách')
  })

  it('shows both gift cards whatever ?nha is', () => {
    for (const search of ['', '?nha=trai', '?nha=gai']) {
      const html = renderToStaticMarkup(<App search={search} />)
      expect(html.match(/Chép số tài khoản/g)).toHaveLength(2)
    }
  })

  it('clips a very long guest name in the rendered hero', () => {
    const html = renderToStaticMarkup(<App search={`?khach=${'a'.repeat(200)}`} />)
    expect(html).toContain('a'.repeat(40))
    expect(html).not.toContain('a'.repeat(41))
  })
})

describe('HeroSection petals', () => {
  it('renders decorative petals that are hidden from assistive technology', () => {
    const html = renderToStaticMarkup(<HeroSection guestName={null} />)
    expect(html.match(/class="petal-fall"/g)?.length).toBeGreaterThanOrEqual(10)
    expect(html).toMatch(/<div class="petal-field[^"]*" aria-hidden="true">/)
    for (const id of [1, 2, 3]) expect(html).toContain(`href="#petal-${id}"`)
  })

  it('paints the petals above the scrim but below the text', () => {
    const html = renderToStaticMarkup(<HeroSection guestName={null} />)
    expect(html.indexOf('hero-scrim')).toBeLessThan(html.indexOf('petal-field'))
    expect(html.indexOf('petal-field')).toBeLessThan(html.indexOf('hero-inner'))
  })

  it('runs on its own, with no pause control on the page', () => {
    const html = renderToStaticMarkup(<HeroSection guestName={null} />)
    expect(html).not.toContain('petal-toggle')
  })

  it('defines both petal shapes it references', () => {
    const html = renderToStaticMarkup(<HeroSection guestName={null} />)
    for (const id of [1, 2, 3]) {
      expect(html).toContain(`id="petal-${id}"`)
      expect(html).toContain(`id="petal-grad-${id}"`)
    }
  })

  it('keeps the invitation, names and call to action as real text', () => {
    const html = renderToStaticMarkup(<HeroSection guestName="Anh Minh" />)
    expect(html).toContain('Anh Minh')
    expect(html).toContain(weddingConfig.couple.bride)
    expect(html).toContain('Xem thời gian')
  })
})

describe('HeroSection', () => {
  it('uses a generic invitation without a guest name', () => {
    expect(renderToStaticMarkup(<HeroSection guestName={null} />)).toContain('quý khách')
  })

  it('addresses the guest by name and escapes markup', () => {
    const html = renderToStaticMarkup(<HeroSection guestName="<b>Anh Minh</b>" />)
    expect(html).toContain('&lt;b&gt;Anh Minh&lt;/b&gt;')
    expect(html).not.toContain('<b>Anh Minh</b>')
  })
})
