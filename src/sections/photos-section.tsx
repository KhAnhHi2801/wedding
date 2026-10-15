import { useState } from 'react'
import { PhotoViewer } from '../components/photo-viewer'
import { photos } from '../config/assets'
import { photoPicker } from '../journey/photo-state'

/**
 * Phần ảnh cưới. Khi hành trình 3D chạy, phần này chỉ là đoạn cuộn trong suốt (CSS) để camera lướt qua các ảnh khung
 * vòm trong cảnh 3D phía sau; chạm vào ảnh 3D hoặc nút "Xem tất cả ảnh" mở trình xem toàn màn hình. Khi không có 3D
 * (không WebGL, giảm chuyển động, lỗi) thì hiện lưới ảnh khung vòm HTML, dùng đầy đủ. Ảnh lấy từ thư mục
 * public/assets/photos (xem src/config/assets.ts); thư mục trống thì không hiện phần này.
 */
export function PhotosSection() {
  const [viewing, setViewing] = useState<number | null>(null)
  if (photos.length === 0) return null

  // Canvas 3D nằm sau nội dung và không nhận chạm: đổi điểm chạm sang toạ độ chuẩn hóa rồi hỏi cảnh ảnh nào trúng.
  const onTapScene = (event: React.MouseEvent) => {
    const x = (event.clientX / window.innerWidth) * 2 - 1
    const y = -((event.clientY / window.innerHeight) * 2 - 1)
    const hit = photoPicker.pick(x, y)
    if (hit !== null) setViewing(hit)
  }

  return (
    <section className="section section-photos" id="photos" aria-labelledby="photos-title">
      <div className="photo-path-stage">
        <h2 className="section-title" id="photos-title">
          Ảnh cưới
        </h2>
        <p className="section-sub">Bước vào những khoảnh khắc của chúng mình</p>
        <div className="photo-path-tap" onClick={onTapScene} aria-hidden="true" />
        <p className="photo-path-hint" aria-hidden="true">
          Cuộn để đi tiếp · Chạm ảnh để phóng to
        </p>
        <button type="button" className="photo-path-open" onClick={() => setViewing(photoPicker.focus)}>
          Xem tất cả ảnh
        </button>
      </div>
      <ul className="photo-arch-grid">
        {photos.map((photo, index) => (
          <li key={photo.src}>
            <button type="button" className="photo-arch" onClick={() => setViewing(index)} aria-label={`Xem ảnh ${index + 1}: ${photo.alt}`}>
              <img src={photo.src} alt="" width={photo.width} height={photo.height} loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>
      <PhotoViewer photos={photos} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
    </section>
  )
}
