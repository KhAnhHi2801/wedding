import { useState } from 'react'
import { ActionBar } from './components/action-bar'
import { MusicToggle } from './components/music-toggle'
import { weddingConfig } from './config/wedding-config'
import { parseInvite } from './lib/url-params'
import { EventsSection } from './sections/events-section'
import { GiftSection } from './sections/gift-section'
import { HeroSection } from './sections/hero-section'
import { PhotosPlaceholder } from './sections/placeholder-sections'
import { WishesSection } from './sections/wishes-section'

interface AppProps {
  /** Query string; mặc định lấy từ URL hiện tại. Chỉ truyền vào khi test. */
  search?: string
}

export default function App({ search }: AppProps) {
  // Tham số URL chỉ đọc một lần khi tải trang.
  const [invite] = useState(() => parseInvite(search ?? window.location.search))

  return (
    <>
      <HeroSection guestName={invite.guestName} />
      <main>
        <EventsSection side={invite.side} />
        <PhotosPlaceholder />
        <WishesSection />
        <GiftSection />
      </main>
      <ActionBar />
      <MusicToggle src={weddingConfig.music} />
    </>
  )
}
