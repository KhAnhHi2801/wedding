import { useRef, useState } from 'react'
import { PhotoViewer } from '../components/photo-viewer'
import { photos } from '../config/assets'
import { useRedThread } from '../hooks/use-red-thread'

const KNOT_RADIUS = 4.6
/** Bán kính vùng quanh nút thắt nơi sợi chỉ nổi lên trên ảnh (px). */
const SURFACE_RADIUS = 20

/** Nơ buộc ở cuối sợi tơ hồng. */
function Bow() {
  return (
    <svg className="bow" viewBox="0 0 80 54" width="88" aria-hidden="true" focusable="false">
      <path d="M40 24 C31 4 6 4 8 20 C10 36 32 31 40 24 Z" />
      <path d="M40 24 C49 4 74 4 72 20 C70 36 48 31 40 24 Z" />
      <path className="bow-tail" d="M40 27 C36 37 30 44 23 51 M40 27 C44 37 50 44 57 51" />
      <circle cx="40" cy="24" r="5" />
    </svg>
  )
}

/**
 * Gallery "sợi tơ hồng": một sợi chỉ đỏ luồn qua từng bức ảnh, được vẽ dần theo ngón tay cuộn, mỗi ảnh hiện ra
 * khi sợi chỉ chạm tới và được buộc bằng một nút thắt; cuối cùng buộc thành nơ. Mọi ảnh luôn xem được bằng cách
 * cuộn và chạm để xem toàn màn hình. Bật giảm chuyển động thì sợi chỉ và ảnh hiện đủ ngay.
 */
export function ThreadGallery() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const { geometry, pathRef, animated, reached } = useRedThread(containerRef, photos.length)
  const allReached = reached >= photos.length

  return (
    <section className="section section-photos" id="photos" aria-labelledby="photos-title">
      <h2 className="section-title" id="photos-title">
        Ảnh cưới
      </h2>
      <p className="section-sub">Mỗi khoảnh khắc được se lại bằng một sợi tơ hồng</p>

      <div ref={containerRef} className="thread-gallery">
        {/* Sợi chỉ nằm dưới các ảnh (chỉ hiện ở khoảng trống giữa các ảnh); chỉ nút thắt nằm trên, ở góc ảnh. */}
        {geometry && (
          <svg
            className="thread-svg thread-under"
            width={geometry.width}
            height={geometry.height}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            aria-hidden="true"
            focusable="false"
          >
            <path className="thread-shadow" d={geometry.d} />
            <path ref={pathRef} className="thread-line" d={geometry.d} />
          </svg>
        )}
        {photos.map((photo, index) => {
          const side = index % 2 === 0 ? 'left' : 'right'
          const hidden = animated && index >= reached
          return (
            <figure
              key={photo.src}
              data-pin
              data-side={side}
              className={hidden ? 'photo-card is-hidden' : 'photo-card'}
            >
              <button
                type="button"
                className="photo-frame"
                aria-label={`Xem ảnh ${index + 1}: ${photo.alt}`}
                onClick={() => setViewing(index)}
              >
                <img
                  src={photo.src}
                  width={photo.width}
                  height={photo.height}
                  alt={photo.alt}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </figure>
          )
        })}

        <div data-thread-end className={animated && !allReached ? 'bow-wrap is-hidden' : 'bow-wrap'}>
          <Bow />
          <p className="bow-caption">Duyên lành đã định ♡</p>
        </div>

        {geometry && (
          <svg
            className="thread-svg thread-knots"
            width={geometry.width}
            height={geometry.height}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <clipPath id="thread-pin-clip">
                {geometry.pins.map((pin, index) => (
                  <circle key={index} cx={pin.x} cy={pin.y} r={SURFACE_RADIUS} />
                ))}
              </clipPath>
            </defs>
            {/* Bản sao sợi chỉ nổi trên ảnh, chỉ lộ quanh nút thắt: nhìn như chỉ vòng qua góc ảnh rồi luồn xuống dưới. */}
            <path className="thread-line thread-over" d={geometry.d} clipPath="url(#thread-pin-clip)" />
            {geometry.pins.map((pin, index) => (
              <g key={index} transform={`translate(${pin.x} ${pin.y})`}>
                <g className={animated && index >= reached ? 'knot' : 'knot is-tied'}>
                  <circle r={KNOT_RADIUS} />
                  <circle className="knot-shine" cx="-1.4" cy="-1.5" r="1.4" />
                </g>
              </g>
            ))}
          </svg>
        )}
      </div>

      <PhotoViewer photos={photos} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </section>
  )
}
