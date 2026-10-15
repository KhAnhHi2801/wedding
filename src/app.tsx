import { useState } from 'react'
import { ActionBar } from './components/action-bar'
import { MusicToggle } from './components/music-toggle'
import { heroPhoto } from './config/assets'
import { weddingConfig } from './config/wedding-config'
import { useTimeOfDay } from './hooks/use-time-of-day'
import { JourneyCanvas } from './journey/journey-canvas'
import { prefersReducedMotion } from './lib/motion-preference'
import { parseInvite } from './lib/url-params'
import { EventsSection } from './sections/events-section'
import { GardenWalk } from './sections/garden-walk'
import { GiftSection } from './sections/gift-section'
import { HeroSection } from './sections/hero-section'
import { PhotosSection } from './sections/photos-section'
import { WishesSection } from './sections/wishes-section'

interface AppProps {
  /** Query string; mặc định lấy từ URL hiện tại. Chỉ truyền vào khi test. */
  search?: string
}

export default function App({ search }: AppProps) {
  // Tham số URL chỉ đọc một lần khi tải trang.
  const [invite] = useState(() => parseInvite(search ?? window.location.search))
  // Đọc một lần khi tải trang, cùng cách với tham số URL.
  const [calm] = useState(prefersReducedMotion)
  useTimeOfDay(calm)

  return (
    <>
      <JourneyCanvas calm={calm} heroSrc={heroPhoto?.src ?? null} />
      <HeroSection guestName={invite.guestName} />
      <main>
        <GardenWalk />
        <EventsSection side={invite.side} />
        <PhotosSection />
        <WishesSection />
        <GiftSection />
      </main>
      <ActionBar />
      <MusicToggle src={weddingConfig.music} />
    </>
  )
}
