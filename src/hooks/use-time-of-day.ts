import { useEffect } from 'react'
import { journeyProgress } from '../journey/journey-progress'
import { scrollProgress, smoothProgress } from '../journey/scroll-progress'
import { quantizeTod, todColor, todFromProgress } from '../journey/time-of-day'

const readTarget = () =>
  scrollProgress(window.scrollY, document.documentElement.scrollHeight, window.innerHeight)

/**
 * Theo dõi cuộn trang và ghi "thời gian trong ngày" ra CSS (`--tod`, `--journey-bg`) cùng
 * `journeyProgress` cho engine 3D. Chạy cả khi không có 3D để nền HTML vẫn đổi cùng nhịp. Vòng lặp chỉ chạy khi giá trị
 * còn đang tiến tới đích. `calm`: không làm mượt, nền đổi theo bước.
 */
export function useTimeOfDay(calm: boolean): void {
  useEffect(() => {
    const root = document.documentElement
    let target = readTarget()
    let value = target
    let frame = 0
    let last = 0

    // Ghi biến CSS trên :root buộc trình duyệt tính lại style cả trang: chỉ ghi khi giá trị thật sự đổi.
    const written = { tod: '', bg: '' }
    const apply = () => {
      const raw = todFromProgress(value)
      const tod = calm ? quantizeTod(raw) : raw
      const todText = tod.toFixed(2)
      if (todText !== written.tod) {
        written.tod = todText
        root.style.setProperty('--tod', todText)
      }
      const bg = todColor(tod)
      if (bg !== written.bg) {
        written.bg = bg
        root.style.setProperty('--journey-bg', bg)
      }
      journeyProgress.set(value, tod)
    }

    const step = (now: number) => {
      value = smoothProgress(value, target, (now - last) / 1000, calm ? 0 : undefined)
      last = now
      apply()
      frame = value === target ? 0 : requestAnimationFrame(step)
    }

    const retarget = () => {
      const next = readTarget()
      if (next === target) return
      target = next
      if (!frame) {
        last = performance.now()
        frame = requestAnimationFrame(step)
      }
    }

    apply()
    window.addEventListener('scroll', retarget, { passive: true })
    window.addEventListener('resize', retarget)
    // Chiều cao trang đổi khi ảnh/font tải xong: cùng vị trí cuộn nhưng tiến độ khác.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(retarget)
    observer?.observe(document.body)

    return () => {
      window.removeEventListener('scroll', retarget)
      window.removeEventListener('resize', retarget)
      observer?.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [calm])
}
