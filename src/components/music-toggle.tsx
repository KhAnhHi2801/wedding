import { useRef, useState } from 'react'

interface MusicToggleProps {
  src: string | null
}

/** Nút bật/tắt nhạc nền. Không có file nhạc thì không hiện. Mặc định tắt (trình duyệt chặn tự phát). */
export function MusicToggle({ src }: MusicToggleProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  if (!src) return null

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
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
