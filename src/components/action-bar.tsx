import { useEffect, useState } from 'react'

// Icon nét 2px theo bộ Lucide, tô theo currentColor để đổi màu theo trạng thái active.
const ITEMS = [
  {
    id: 'events',
    label: 'Chỉ đường',
    icon: (
      <>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  },
  {
    id: 'wishes',
    label: 'Lời chúc',
    icon: (
      <>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </>
    ),
  },
  {
    id: 'gift',
    label: 'Yêu thương',
    icon: (
      <>
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v13" />
        <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
      </>
    ),
  },
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
          <svg
            className="action-bar-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {icon}
          </svg>
          <span>{label}</span>
        </a>
      ))}
    </nav>
  )
}
