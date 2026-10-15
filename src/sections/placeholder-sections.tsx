/**
 * Khung giữ chỗ cho các section làm ở phase sau (gallery 3D, bầu trời lời chúc),
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

export function WishesPlaceholder() {
  return (
    <section className="section section-sky" id="wishes" aria-labelledby="wishes-title">
      <h2 className="section-title" id="wishes-title">
        Lời chúc
      </h2>
      <p className="section-sub">Mỗi lời chúc là một chiếc đèn lồng trên bầu trời</p>
      <div className="placeholder-box" />
    </section>
  )
}
