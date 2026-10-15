import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { buildThreadPath, countReached, findLengthAtY, lengthNearPoint, type Point } from '../lib/thread-path'

interface ThreadGeometry {
  d: string
  width: number
  height: number
  /** Vị trí các nút thắt (góc trên phía trong của từng ảnh) trong hệ toạ độ của container. */
  pins: Point[]
  /** Vị trí nơ ở cuối sợi chỉ. */
  end: Point | null
}

const SAMPLE_COUNT = 160
/** Điểm trên màn hình mà "đầu bút" của sợi chỉ bám theo (0 = đỉnh, 1 = đáy). */
const LEAD = 0.72
/** Sợi chỉ chùng xuống giữa hai ảnh (px) cho tự nhiên. */
const SAG = 26
/** Nút thắt cách mép ảnh bao nhiêu px (theo cả hai chiều). */
const PIN_INSET = 18

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Đo theo bố cục (offsetLeft/offsetTop/offsetWidth), KHÔNG dùng getBoundingClientRect: cái sau tính cả transform,
 * mà ảnh chưa hiện đang bị dịch xuống và thu nhỏ, nên đo lại lúc đó (đổi font, ảnh tải xong, xoay màn hình)
 * sẽ đặt nút thắt lệch khỏi góc ảnh. Phép xoay (nghiêng) của ảnh được tính lại bằng toán để nút thắt vẫn nằm
 * đúng trên góc đã nghiêng.
 */
function pinPosition(el: HTMLElement): Point {
  const w = el.offsetWidth
  const h = el.offsetHeight
  const side = el.getAttribute('data-side')
  const tilt = (parseFloat(getComputedStyle(el).getPropertyValue('--tilt')) || 0) * (Math.PI / 180)
  // Vị trí góc so với tâm ảnh (chưa xoay): góc trên phía trong.
  const dx = side === 'left' ? w / 2 - PIN_INSET : -(w / 2 - PIN_INSET)
  const dy = -(h / 2 - PIN_INSET)
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  return {
    x: el.offsetLeft + w / 2 + dx * cos - dy * sin,
    y: el.offsetTop + h / 2 + dx * sin + dy * cos,
  }
}

function centerOf(el: HTMLElement): Point {
  return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 }
}

/**
 * Sợi tơ hồng luồn qua các ảnh và được vẽ dần theo cuộn trang.
 *
 * Container chứa các phần tử `[data-pin]` (mỗi ảnh một nút thắt, có `data-side="left|right"`) và tuỳ chọn một
 * phần tử `[data-thread-end]` (nơ cuối); chúng phải là con trực tiếp của container và container phải là
 * `position: relative`. Hook đo vị trí thật, dựng đường cong, rồi cập nhật `stroke-dashoffset` mỗi frame cuộn.
 * Ban đầu mọi thứ hiện đủ (nếu JS lỗi thì ảnh vẫn xem được); chỉ khi đo xong và được phép chuyển động mới ẩn
 * các ảnh chưa được sợi chỉ chạm tới. Bật giảm chuyển động thì giữ nguyên trạng thái hiện đủ.
 */
export function useRedThread(containerRef: RefObject<HTMLElement | null>, photoCount: number) {
  const [geometry, setGeometry] = useState<ThreadGeometry | null>(null)
  const [animated, setAnimated] = useState(false)
  const [reached, setReached] = useState(photoCount)
  const pathRef = useRef<SVGPathElement>(null)

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const width = container.offsetWidth
    const height = container.offsetHeight
    if (width === 0) return // đang ẩn hoặc chưa có kích thước: ResizeObserver sẽ gọi lại khi có
    const pinEls = [...container.querySelectorAll<HTMLElement>('[data-pin]')]
    if (pinEls.length === 0) return

    const pins = pinEls.map(pinPosition)
    const endEl = container.querySelector<HTMLElement>('[data-thread-end]')
    const end = endEl ? centerOf(endEl) : null

    const points: Point[] = [{ x: width / 2, y: 0 }]
    const chain = end ? [...pins, end] : pins
    chain.forEach((pin, i) => {
      const prev = points[points.length - 1]
      // Điểm chùng ở giữa hai điểm liên tiếp để sợi chỉ võng xuống chứ không căng thẳng.
      if (i > 0 || prev.y < pin.y - 40) {
        points.push({ x: (prev.x + pin.x) / 2, y: (prev.y + pin.y) / 2 + SAG })
      }
      points.push(pin)
    })

    const d = buildThreadPath(points)
    setGeometry((current) =>
      current && current.d === d && current.width === width && current.height === height
        ? current
        : { d, width, height, pins, end },
    )
  }, [containerRef])

  // Đo ngay trước khi vẽ lần đầu, và đo lại khi kích thước container đổi.
  useLayoutEffect(() => {
    measure()
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, measure])

  // Có hình học mới: lấy mẫu độ dài sợi chỉ rồi gắn sự kiện cuộn.
  useLayoutEffect(() => {
    const path = pathRef.current
    const container = containerRef.current
    if (!geometry || !path || !container) return

    const total = path.getTotalLength()
    const samples = Array.from({ length: SAMPLE_COUNT + 1 }, (_, i) => {
      const point = path.getPointAtLength((total * i) / SAMPLE_COUNT)
      return { len: (total * i) / SAMPLE_COUNT, x: point.x, y: point.y }
    })
    const pinLengths = geometry.pins.map((pin) => lengthNearPoint(samples, pin))
    // Cả đường chính lẫn bóng đổ đều phải được vẽ dần, nếu không bóng hiện sẵn phía trước đầu sợi chỉ.
    const drawables = [...container.querySelectorAll<SVGPathElement>('.thread-line, .thread-shadow')]
    const setOffset = (value: number) => drawables.forEach((el) => (el.style.strokeDashoffset = String(value)))
    drawables.forEach((el) => (el.style.strokeDasharray = String(total)))

    // Chỉ đọc cài đặt giảm chuyển động lúc đo; đổi cài đặt hệ thống khi đang mở trang có hiệu lực ở lần đo kế tiếp.
    if (prefersReducedMotion()) {
      // Sợi chỉ và mọi ảnh hiện đủ ngay, không theo cuộn.
      setOffset(0)
      // oxlint-disable-next-line react/set-state-in-effect
      setAnimated(false)
      setReached(photoCount)
      return
    }

    let frame = 0
    const update = () => {
      frame = 0
      const top = container.getBoundingClientRect().top
      const drawn = findLengthAtY(samples, window.innerHeight * LEAD - top)
      setOffset(total - drawn)
      setReached(countReached(pinLengths, drawn))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    setAnimated(true)
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [geometry, containerRef, photoCount])

  return { geometry, pathRef, animated, reached }
}
