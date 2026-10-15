import { useState } from 'react'
import { PhotoCorridor } from '../components/photo-corridor'
import { PhotoViewer } from '../components/photo-viewer'
import { photos } from '../config/assets'
import { chooseGallery, type GalleryChoice } from '../lib/gallery-layout'
import { probeWebgl } from '../lib/webgl-support'
import { ThreadGallery } from './thread-gallery'

const browser = () => (typeof window === 'undefined' ? undefined : window)
const prefersReducedMotion = () => Boolean(browser()?.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const debugOn = () => new URLSearchParams(browser()?.location.search ?? '').has('debug')

function CorridorGallery({ calm, onFail }: { calm: boolean; onFail: (reason: string) => void }) {
  const [viewing, setViewing] = useState<number | null>(null)
  return (
    <section className="section section-corridor" id="photos" aria-labelledby="photos-title">
      <h2 className="section-title" id="photos-title">
        Ảnh cưới
      </h2>
      <p className="section-sub">Bước vào những khoảnh khắc của chúng mình</p>
      <PhotoCorridor photos={photos} onOpenViewer={setViewing} calm={calm} onFail={onFail} />
      <PhotoViewer photos={photos} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </section>
  )
}

/**
 * Phần ảnh cưới. Mặc định là hành lang 3D (WebGL); máy không có WebGL hoặc WebGL lỗi giữa chừng thì dùng gallery
 * sợi tơ hồng (thuần SVG). Khách bật giảm chuyển động vẫn thấy hành lang, ở bản yên tĩnh. Ép bằng
 * ?gallery=thread|corridor khi thử; thêm ?debug để hiện lý do chọn (hữu ích khi một điện thoại lại rơi vào dự phòng).
 * Ảnh lấy từ thư mục public/assets/photos (xem src/config/assets.ts); thư mục trống thì không hiện phần này.
 */
export function PhotosSection() {
  const [choice, setChoice] = useState<GalleryChoice>(() =>
    chooseGallery({
      webgl: probeWebgl(),
      reducedMotion: prefersReducedMotion(),
      search: browser()?.location.search ?? '',
    }),
  )
  if (photos.length === 0) return null

  const gallery =
    choice.mode === 'thread' ? (
      <ThreadGallery />
    ) : (
      <CorridorGallery
        calm={choice.calm}
        onFail={(reason) => setChoice({ mode: 'thread', calm: choice.calm, reason: `hành lang lỗi: ${reason}` })}
      />
    )
  return (
    <>
      {debugOn() && (
        <p className="gallery-debug" role="status">
          Gallery: {choice.mode === 'corridor' ? 'hành lang 3D' : 'sợi tơ hồng'} · {choice.reason}
        </p>
      )}
      {gallery}
    </>
  )
}
