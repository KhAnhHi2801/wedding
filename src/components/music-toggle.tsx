import { useEffect, useRef, useState } from 'react'

interface MusicToggleProps {
  src: string | null
}

const TARGET_VOLUME = 0.6
const FADE_MS = 2500

/**
 * Nút bật/tắt nhạc nền. Không có file nhạc thì không hiện.
 * Trình duyệt chặn tự phát, nên nhạc bắt đầu (fade-in) ở lần chạm/bấm phím đầu tiên của khách: chạm vào hero để mở cổng
 * cũng là lần chạm đó. Khách đã bấm nút nhạc thì không tự phát nữa. Tab bị ẩn thì tạm dừng, quay lại thì phát tiếp.
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

    const disarm = () => {
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
    }
    function onGesture(event: Event) {
      // Bấm chính nút nhạc là lựa chọn của khách: để nút tự xử lý, không tự phát chen vào.
      if (event.target instanceof Element && event.target.closest('.music-toggle')) {
        disarm()
        return
      }
      disarm()
      audio!.play().then(fadeIn, () => {
        // Bị từ chối: nút nhạc vẫn dùng được, khách bấm tay.
      })
    }
    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)

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
        <span aria-hidden="true">♪</span>
      </button>
    </>
  )
}
