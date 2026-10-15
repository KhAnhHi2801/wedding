import { weddingConfig } from '../config/wedding-config'
import type { BankAccount } from '../config/wedding-config'
import { useCopyToClipboard } from '../hooks/use-copy-to-clipboard'

interface GiftCardProps {
  role: string
  name: string
  account: BankAccount
}

function GiftCard({ role, name, account }: GiftCardProps) {
  const { status, copy } = useCopyToClipboard()
  const announcement =
    status === 'copied'
      ? 'Đã chép số tài khoản'
      : status === 'failed'
        ? 'Không chép được. Hãy nhấn giữ vào số tài khoản để chọn và chép.'
        : ''

  return (
    <article className="card gift-card">
      <h3 className="gift-who">
        {role} · {name}
      </h3>
      {/* Không bọc trong link/nút: khách cần nhấn giữ ảnh để lưu. */}
      <img
        className="gift-qr"
        src={account.qrSrc}
        width={600}
        height={600}
        alt={`Mã QR của ${role.toLowerCase()} ${name}`}
        loading="lazy"
        decoding="async"
      />
      <p className="gift-bank">
        {account.bank} · {account.holder}
      </p>
      {/* user-select: all để khi nút sao chép bị chặn, khách nhấn giữ là chọn được cả số. */}
      <p className="gift-number">{account.number}</p>
      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={() => copy(account.number.replace(/\s/g, ''))}
      >
        {status === 'copied' ? 'Đã chép ✓' : 'Chép số tài khoản'}
      </button>
      {status === 'failed' && (
        <p className="gift-copy-fallback">
          Chưa chép được tự động. Bạn hãy nhấn giữ vào số tài khoản ở trên để chép nhé.
        </p>
      )}
      <span className="visually-hidden" role="status">
        {announcement}
      </span>
    </article>
  )
}

export function GiftSection() {
  const { couple, gift } = weddingConfig

  return (
    <section className="section section-gift" id="gift" aria-labelledby="gift-title">
      <h2 className="section-title" id="gift-title">
        Gửi yêu thương
      </h2>
      <p className="section-sub">
        Sự hiện diện của bạn đã là món quà quý giá nhất với chúng mình.
        <br />
        Mọi lời chúc phúc và món quà gửi xa, chúng mình xin trân trọng đón nhận qua thông tin dưới
        đây.
      </p>
      <GiftCard role="Cô dâu" name={couple.bride} account={gift.bride} />
      <GiftCard role="Chú rể" name={couple.groom} account={gift.groom} />
      <p className="hint">
        Bạn có thể nhấn giữ hình để lưu, rồi mở trong ứng dụng ngân hàng của mình.
      </p>
      <p className="hint thanks">Cảm ơn bạn đã yêu thương và đồng hành cùng chúng mình ♡</p>
    </section>
  )
}
