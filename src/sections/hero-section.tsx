import { HeroPetals } from '../components/hero-petals'
import { heroPhoto } from '../config/assets'
import { weddingConfig } from '../config/wedding-config'

interface HeroSectionProps {
  guestName: string | null
}

export function HeroSection({ guestName }: HeroSectionProps) {
  const { couple, dateLabel } = weddingConfig

  return (
    <header className="hero" id="hero">
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
        <a className="btn btn-on-photo" href="#events">
          Xem thời gian &amp; địa điểm
        </a>
      </div>
    </header>
  )
}
