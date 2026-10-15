import { useEffect } from 'react'
import { journeyProgress } from '../journey/journey-progress'
import { anchoredProgress, scrollProgress, smoothProgress, type ProgressAnchor } from '../journey/scroll-progress'
import { quantizeTod, todColor, todFromProgress } from '../journey/time-of-day'

/** Camera đã đi hết khu vườn (3 cổng vòm hoa) khi khách cuộn qua hết phần lịch trình. */
const GARDEN_END_PROGRESS = 0.52
/** Camera đã đi hết đường ảnh (khung vòm) khi khách cuộn qua hết phần ảnh cưới. */
const PHOTOS_END_PROGRESS = 0.71
/** Phần ảnh vừa dính vào màn hình (phần sự kiện đã trôi hết): từ đây mới có ảnh trong cảnh. */
const PHOTOS_START_PROGRESS = 0.54

/**
 * Tiến độ hành trình tại vị trí cuộn hiện tại. Neo theo nội dung: hết phần lịch trình thì camera vừa đi hết khu vườn,
 * phần còn lại của trang chia đều tới cuối. Khi chưa có phần lịch trình trên màn hình (trang đang khóa chờ cổng mở, hoặc
 * không có) thì chia đều theo chiều dài cả trang.
 */
function readTarget(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  const linear = scrollProgress(window.scrollY, document.documentElement.scrollHeight, window.innerHeight)
  const events = document.getElementById('events')
  if (!events || events.offsetParent === null || scrollable <= 0) return linear
  const gardenEnd = events.getBoundingClientRect().bottom + window.scrollY - window.innerHeight
  if (gardenEnd <= 0 || gardenEnd >= scrollable) return linear
  const anchors: ProgressAnchor[] = [
    { y: 0, progress: 0 },
    { y: gardenEnd, progress: GARDEN_END_PROGRESS },
  ]
  const photos = document.getElementById('photos')
  if (photos && photos.offsetParent !== null) {
    const rect = photos.getBoundingClientRect()
    const photosStart = rect.top + window.scrollY
    const photosEnd = rect.bottom + window.scrollY - window.innerHeight
    if (photosStart > gardenEnd && photosEnd > photosStart && photosEnd < scrollable) {
      anchors.push({ y: photosStart, progress: PHOTOS_START_PROGRESS }, { y: photosEnd, progress: PHOTOS_END_PROGRESS })
      // Giữ camera đứng yên ở ảnh cuối tới khi phần ảnh trượt khỏi màn hình: phần sau phủ lên như tấm màn, không để
      // ảnh cuối tan thành khoảng trống trong lúc khung dính đang rời đi.
      const photosBottom = rect.bottom + window.scrollY
      if (photosBottom < scrollable) anchors.push({ y: photosBottom, progress: PHOTOS_END_PROGRESS })
    }
  }
  anchors.push({ y: scrollable, progress: 1 })
  return anchoredProgress(window.scrollY, anchors)
}

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
