import { useEffect, useState, type RefObject } from 'react'

/** true khi phần tử gần vùng nhìn thấy. Không có IntersectionObserver thì coi như luôn gần. */
export function useNearViewport(ref: RefObject<Element | null>, rootMargin: string): boolean {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      // Môi trường không có IntersectionObserver: không theo dõi được, coi như luôn gần.
      // oxlint-disable-next-line react/set-state-in-effect
      setNear(true)
      return
    }
    // Trình duyệt gộp nhiều lần giao cắt vào một lần gọi: trạng thái hiện tại là entry CUỐI CÙNG, không phải đầu tiên.
    const observer = new IntersectionObserver((entries) => setNear(entries[entries.length - 1].isIntersecting), {
      rootMargin,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin])
  return near
}
