import { useEffect, useState } from 'react'

const ITEMS = [
  { id: 'events', label: 'Chỉ đường', icon: '📍' },
  { id: 'wishes', label: 'Lời chúc', icon: '💌' },
  { id: 'gift', label: 'Yêu thương', icon: '🎁' },
] as const

type ItemId = (typeof ITEMS)[number]['id']

// Theo dõi cả các section không có trong thanh để bỏ tô sáng khi khách cuộn sang đó.
const OBSERVED_IDS = ['hero', 'events', 'photos', 'wishes', 'gift']

const isItemId = (id: string): id is ItemId => ITEMS.some((item) => item.id === id)

/** Thanh lối tắt cố định ở đáy: khách cần giờ/địa điểm chỉ cách một lần chạm. */
export function ActionBar() {
  const [active, setActive] = useState<ItemId | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(isItemId(entry.target.id) ? entry.target.id : null)
        }
      },
      // Vùng kích hoạt là dải ngang giữa màn hình.
      { rootMargin: '-45% 0px -45% 0px' },
    )
    for (const id of OBSERVED_IDS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <nav className="action-bar" aria-label="Lối tắt">
      {ITEMS.map(({ id, label, icon }) => (
        <a
          key={id}
          href={`#${id}`}
          className={active === id ? 'active' : undefined}
          aria-current={active === id ? 'location' : undefined}
        >
          <span aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </a>
      ))}
    </nav>
  )
}
