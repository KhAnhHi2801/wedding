import { useEffect, useRef, useState } from 'react'

interface MusicToggleProps {
  src: string | null
}

const TARGET_VOLUME = 0.6
const FADE_MS = 2500

/**
 * Nút bật/tắt nhạc nền. Không có file nhạc thì không hiện.
 * Thử tự phát (fade-in) ngay khi vào trang. Trình duyệt thường chặn phát tiếng khi khách chưa thao tác, nên nếu bị chặn thì
 * nhạc vào ở thao tác đầu tiên (chạm, click, phím). Khách đã bấm nút nhạc thì không tự phát nữa. Tab ẩn thì tạm dừng.
 */
export function MusicToggle({ src }: MusicToggleProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!src || !audio) return
    let fadeFrame = 0
    let resumeOnVisible = false

    const fadeIn = () => {
      const start = performance.now()
      audio.volume = 0
      const step = (now: number) => {
        audio.volume = Math.min(TARGET_VOLUME, ((now - start) / FADE_MS) * TARGET_VOLUME)
        if (audio.volume < TARGET_VOLUME) fadeFrame = requestAnimationFrame(step)
      }
      fadeFrame = requestAnimationFrame(step)
    }

    let done = false // đã phát nhạc (hoặc khách đã tự chọn): không tự phát nữa

    // Chạm trên cảm ứng chỉ được trình duyệt tính là "thao tác của người dùng" ở pointerup/click (pointerdown thì không).
    const GESTURES = ['pointerup', 'click', 'keydown'] as const
    const disarm = () => GESTURES.forEach((type) => window.removeEventListener(type, onGesture, true))

    // Phát có tiếng ngay trong thao tác của khách (chạm hero cũng là lúc cổng bắt đầu mở), rồi tăng dần âm lượng.
    const start = () => {
      if (done) return
      audio.volume = 0
      audio.play().then(
        () => {
          done = true
          disarm()
          fadeIn()
        },
        () => {
          // Bị từ chối (chưa có thao tác hợp lệ): chờ lần chạm tiếp theo.
        },
      )
    }

    function onGesture(event: Event) {
      // Bấm chính nút nhạc là lựa chọn của khách: để nút tự xử lý, không tự phát chen vào.
      if (event.target instanceof Element && event.target.closest('.music-toggle')) {
        done = true
        disarm()
        return
      }
      start()
    }
    GESTURES.forEach((type) => window.addEventListener(type, onGesture, true))

    // Thử phát ngay khi vào trang: trình duyệt cho phép thì nhạc vào luôn (vd. khách đã tương tác nhiều với site);
    // bị chặn thì chờ thao tác đầu tiên (chạm, click, phím) ở trên.
    start()

    const onVisibility = () => {
      if (document.hidden) {
        resumeOnVisible = !audio.paused
        audio.pause()
      } else if (resumeOnVisible) {
        resumeOnVisible = false
        audio.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disarm()
      cancelAnimationFrame(fadeFrame)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [src])

  if (!src) return null

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.muted = false
      audio.volume = TARGET_VOLUME
      try {
        await audio.play()
      } catch {
        // Trình duyệt từ chối phát: trạng thái do sự kiện pause/play bên dưới quyết định.
      }
    } else {
      audio.pause()
    }
  }

  return (
    <>
      {/* Trạng thái bám theo sự kiện của thẻ audio (cuộc gọi đến, hết bài...) chứ không đoán. */}
      <audio
        ref={audioRef}
        src={src}
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        className="music-toggle"
        aria-pressed={playing}
        aria-label="Nhạc nền"
        onClick={toggle}
      >
        {/* Nốt nhạc; khi nhạc tắt có gạch chéo, khi phát thì đung đưa nhẹ. */}
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="music-icon">
          <path
            d="M9 18V6l10-2v12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
          <circle cx="16.5" cy="16" r="2.5" fill="currentColor" />
          <line className="music-slash" x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </>
  )
}
