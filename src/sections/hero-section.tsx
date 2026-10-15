import { useEffect } from 'react'
import { HeroPetals } from '../components/hero-petals'
import { heroPhoto } from '../config/assets'
import { weddingConfig } from '../config/wedding-config'
import { gate } from '../journey/gate-state'
import { useGateState } from '../journey/use-gate-state'

interface HeroSectionProps {
  guestName: string | null
}

export function HeroSection({ guestName }: HeroSectionProps) {
  const { couple, dateLabel } = weddingConfig
  // Chỉ có ý nghĩa khi cổng 3D đang chạy; không có 3D thì luôn là 'open' và CSS bỏ qua thuộc tính này.
  const gateState = useGateState()

  // Trang bị khóa cuộn khi cổng đóng, nên ý định "cuộn xuống" (lăn chuột, vuốt, phím xuống) được hiểu là mở cổng.
  // Không bắt Space/Enter: chúng đã kích hoạt nút "Mở thiệp" qua click, bắt thêm sẽ mở hai lần và bỏ qua hiệu ứng.
  useEffect(() => {
    if (gateState !== 'closed') return
    const open = () => gate.requestOpen()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === 'End') open()
    }
    window.addEventListener('wheel', open, { passive: true })
    window.addEventListener('touchmove', open, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', open)
      window.removeEventListener('touchmove', open)
      window.removeEventListener('keydown', onKey)
    }
  }, [gateState])

  return (
    // Chạm vào bất kỳ đâu trên hero khi cổng còn đóng cũng mở cổng.
    <header className="hero" id="hero" data-gate={gateState} onClick={gate.requestOpen}>
      {/* Ảnh hero là phần tử LCP: tải ưu tiên, có kích thước cố định để không dịch layout. */}
      {heroPhoto && (
        <img
          className="hero-photo"
          src={heroPhoto.src}
          width={heroPhoto.width}
          height={heroPhoto.height}
          alt={heroPhoto.alt}
          fetchPriority="high"
        />
      )}
      <div className="hero-scrim" aria-hidden="true" />
      {/* Cánh hoa nằm trên lớp tối nền để giữ màu tươi; CSS làm chúng mờ dần khi rơi xuống vùng có chữ. */}
      <HeroPetals />
      <div className="hero-inner">
        <p className="hero-invite">
          Trân trọng kính mời <strong>{guestName ?? 'quý khách'}</strong>
        </p>
        <h1 className="hero-names">
          {couple.bride}
          <span className="hero-amp" aria-hidden="true">
            &amp;
          </span>
          <span className="visually-hidden"> và </span>
          {couple.groom}
        </h1>
        <p className="hero-date">{dateLabel}</p>
        <a className="btn btn-on-photo hero-cta" href="#events">
          Xem thời gian &amp; địa điểm
        </a>
      </div>
      {/* Nằm ngoài .hero-inner để định vị theo cả hero (dưới cổng), không theo tấm bảng. Không có onClick riêng: click nổi
          bọt lên <header> (cả khi bấm bằng bàn phím); thêm handler ở đây sẽ gọi hai lần và bỏ qua hiệu ứng mở. */}
      <button type="button" className="btn hero-open" disabled={gateState === 'opening'}>
        Mở thiệp
      </button>
    </header>
  )
}
