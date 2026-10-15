import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SendError, SendInput, SendOutcome } from '../hooks/use-wishes'
import { useVisualViewportInset } from '../hooks/use-visual-viewport-inset'
import { MESSAGE_MAX, NAME_MAX, WISH_ERROR_TEXT, type WishError } from '../lib/wish-validation'
import { newId } from '../lib/wishes-api'

const API_ERROR_TEXT = {
  not_configured: 'Lời chúc tạm thời chưa mở. Bạn quay lại sau nhé.',
  network: 'Mạng đang chập chờn, bạn thử gửi lại giúp chúng mình nhé.',
  timeout: 'Mạng hơi chậm nên chưa thấy phản hồi, bạn bấm gửi lại giúp chúng mình nhé (lời chúc sẽ không bị gửi trùng).',
  rate_limited: 'Bạn đã gửi khá nhiều lời chúc rồi. Bạn thử lại sau ít phút nhé.',
  too_fast: 'Bạn thử gửi lại sau vài giây nhé.',
  rejected: 'Chưa gửi được lời chúc. Bạn kiểm tra lại nội dung rồi gửi lại nhé.',
  server: 'Hệ thống đang bận, bạn thử lại sau một lát nhé.',
} as const

function errorText(error: SendError): string {
  return error in WISH_ERROR_TEXT
    ? WISH_ERROR_TEXT[error as WishError]
    : API_ERROR_TEXT[error as keyof typeof API_ERROR_TEXT]
}

interface WishFormSheetProps {
  open: boolean
  onClose: () => void
  onSend: (input: SendInput) => Promise<SendOutcome>
  /** Gọi sau khi gửi thành công; `hidden` = chờ duyệt, không hiện công khai. */
  onSent: (hidden: boolean, id?: string) => void
}

/**
 * Form lời chúc dạng bottom sheet, dùng <dialog> gốc: tự khóa focus trong hộp thoại, đóng bằng Esc,
 * tự focus ô đầu tiên và trả focus về nút đã mở nó.
 */
export function WishFormSheet({ open, onClose, onSend, onSent }: WishFormSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openedAt = useRef(0)
  // Giữ nguyên qua các lần bấm gửi lại sau lỗi để máy chủ nhận ra đó là cùng một lời chúc.
  const requestId = useRef(newId())
  const pressedOnBackdrop = useRef(false)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // ô bẫy bot
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const keyboard = useVisualViewportInset(open)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      openedAt.current = Date.now()
      // Đồng bộ với trạng thái DOM của <dialog> (hệ thống bên ngoài React): xóa lỗi cũ khi mở lại.
      // oxlint-disable-next-line react/set-state-in-effect
      setError(null)
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    setPending(true)
    const outcome = await onSend({
      name,
      message,
      elapsedMs: Date.now() - openedAt.current,
      website,
      requestId: requestId.current,
    })
    setPending(false)
    if (outcome.ok) {
      setName('')
      setMessage('')
      requestId.current = newId()
      onClose()
      onSent(outcome.hidden, outcome.id)
    } else {
      setError(errorText(outcome.error))
    }
  }

  // Không cho đóng khi đang gửi: nếu gửi lỗi sau đó, khách sẽ không thấy thông báo lỗi.
  const requestClose = () => {
    if (!pending) onClose()
  }

  const errorId = 'wish-error'
  const describedBy = error ? errorId : undefined
  const messageLength = Array.from(message).length

  return (
    <dialog
      ref={dialogRef}
      className="wish-sheet"
      aria-labelledby="wish-sheet-title"
      style={{
        bottom: keyboard.inset,
        // Khi bàn phím mở, giới hạn chiều cao theo vùng nhìn thấy để tiêu đề và ô tên không tràn lên khỏi màn hình.
        maxHeight: keyboard.visibleHeight ? keyboard.visibleHeight - 12 : undefined,
      }}
      onCancel={(event) => {
        // Esc: đóng được trừ khi đang gửi.
        if (pending) event.preventDefault()
      }}
      onClose={onClose}
      onPointerDown={(event) => {
        pressedOnBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        // Chỉ đóng khi cả lúc nhấn lẫn lúc thả đều ở nền mờ (kéo bôi chữ rồi thả ngoài form thì không đóng).
        if (pressedOnBackdrop.current && event.target === event.currentTarget) requestClose()
        pressedOnBackdrop.current = false
      }}
    >
      <form className="wish-form" onSubmit={submit} noValidate>
        <div className="sheet-handle" aria-hidden="true" />
        <h3 className="wish-form-title" id="wish-sheet-title">
          Gửi lời chúc
        </h3>

        <label className="field">
          <span>Tên của bạn</span>
          <input
            type="text"
            name="name"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="name"
            enterKeyHint="next"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Lời chúc của bạn</span>
          {/* Không đặt maxLength: nó đếm theo đơn vị UTF-16 nên emoji bị cắt sớm. Giới hạn do bộ đếm và kiểm tra bảo đảm. */}
          <textarea
            name="message"
            rows={4}
            value={message}
            aria-invalid={error ? true : undefined}
            aria-describedby={['wish-counter', describedBy].filter(Boolean).join(' ')}
            onChange={(event) => setMessage(event.target.value)}
          />
          <span
            className={messageLength > MESSAGE_MAX ? 'field-counter over' : 'field-counter'}
            id="wish-counter"
          >
            {messageLength}/{MESSAGE_MAX}
          </span>
        </label>

        {/* Ô bẫy: người thật không thấy; bot điền vào thì máy chủ bỏ qua lời chúc. */}
        <input
          className="hp-field"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />

        {error && (
          <p className="form-error" id={errorId} role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={requestClose}>
            Để sau
          </button>
          <button type="submit" className="btn" disabled={pending}>
            {pending ? 'Đang gửi…' : 'Gửi lời chúc'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
