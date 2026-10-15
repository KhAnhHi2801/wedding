import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../app'
import { weddingConfig } from '../config/wedding-config'
import { EventsSection } from './events-section'
import { GiftSection } from './gift-section'
import { HeroSection } from './hero-section'

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
