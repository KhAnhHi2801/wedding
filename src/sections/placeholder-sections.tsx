/**
 * Khung giữ chỗ cho section làm ở phase sau (gallery 3D),
 * để thanh hành động và bố cục trang đã đúng từ phase 1.
 */
export function PhotosPlaceholder() {
  return (
    <section className="section section-photos" id="photos" aria-labelledby="photos-title">
      <h2 className="section-title" id="photos-title">
        Ảnh cưới
      </h2>
      <div className="placeholder-box" />
    </section>
  )
}
