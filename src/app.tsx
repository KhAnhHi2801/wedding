import { useState } from 'react'
import { parseInvite } from './lib/url-params'
import { ChapterNav } from './ui/chapter-nav'
import { ChapterSection } from './ui/chapter-section'
import { InfoSection } from './ui/info-section'
import { PetalToggle } from './ui/petal-toggle'
import { CHAPTERS } from './world/chapters'
import { WorldCanvas } from './world/world-canvas'

interface AppProps {
  /** Query string; mặc định lấy từ URL hiện tại. Chỉ truyền vào khi test. */
  search?: string
}

/**
 * Hai lớp tách bạch: canvas 3D cố định phía sau (không chứa chữ) và nội dung HTML phẳng cuộn phía trước.
 * Canvas đọc vị trí cuộn của trang để lái camera; HTML chỉ biết chương hiện tại qua store.
 */
export default function App({ search }: AppProps) {
  // Tham số URL chỉ đọc một lần khi tải trang.
  const [invite] = useState(() => parseInvite(search ?? window.location.search))

  return (
    <div className='world-page'>
      <a className='skip-link' href='#noi-dung'>
        Bỏ qua hiệu ứng, xem nội dung
      </a>
      <WorldCanvas />
      <main id='noi-dung' className='chapters'>
        {CHAPTERS.map((chapter, index) => (
          <ChapterSection key={chapter.id} chapter={chapter} invite={invite} isOpening={index === 0} />
        ))}
      </main>
      <InfoSection side={invite.side} />
      <ChapterNav />
      <PetalToggle />
    </div>
  )
}
