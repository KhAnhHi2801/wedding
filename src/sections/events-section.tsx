import { EventCard } from '../components/event-card'
import { weddingConfig } from '../config/wedding-config'
import type { Side } from '../lib/url-params'

interface EventsSectionProps {
  /** null = hiện cả hai nhà. */
  side: Side | null
}

const SIDES: Side[] = ['trai', 'gai']

export function EventsSection({ side }: EventsSectionProps) {
  const visibleSides = side ? [side] : SIDES

  return (
    <section className="section" id="events" aria-labelledby="events-title">
      {/* Tiêu đề nằm trên tấm nền kem để luôn đọc rõ khi phía sau là cảnh vườn 3D. */}
      <header className="events-head">
        <h2 className="section-title" id="events-title">
          Thời gian &amp; địa điểm
        </h2>
        <p className="section-sub">Chạm “Chỉ đường” để mở Google Maps</p>
      </header>
      {visibleSides.map((s) => {
        const events = weddingConfig.events.filter((e) => e.side === s)
        if (events.length === 0) return null
        return (
          <div className="event-group" key={s}>
            <h3 className="group-title">{weddingConfig.groupTitles[s]}</h3>
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )
      })}
    </section>
  )
}
