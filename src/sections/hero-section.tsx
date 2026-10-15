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

  return (
    // Cổng mở bằng một lần chạm để hai sợi chỉ se lại (cảnh 3D lắng nghe thao tác trên window), không phải chạm vào hero.
    <header className="hero" id="hero" data-gate={gateState}>
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
      <div className="hero-inner">
        <p className="hero-invite">
          Trân trọng kính mời <strong>{guestName ?? 'quý khách'}</strong>
        </p>
        <h1 className="hero-names">
          <span className="hero-name">{couple.bride}</span>
          <span className="hero-amp" aria-hidden="true">
            &amp;
          </span>
          <span className="visually-hidden"> và </span>
          <span className="hero-name">{couple.groom}</span>
        </h1>
        <p className="hero-date">{dateLabel}</p>
        <a className="btn btn-on-photo hero-cta" href="#events">
          Xem thời gian &amp; địa điểm
        </a>
      </div>
      {/* Gợi ý cử chỉ và lối thoát cho người không chạm được (trình đọc màn hình, mạng chậm): bỏ qua màn se chỉ. */}
      <p className="hero-thread-hint" aria-hidden="true">
        Chạm để se duyên
      </p>
      <button type="button" className="hero-open" disabled={gateState === 'opening'} onClick={gate.requestOpen}>
        <span className="hero-open-label">Bỏ qua</span>
      </button>
    </header>
  )
}
