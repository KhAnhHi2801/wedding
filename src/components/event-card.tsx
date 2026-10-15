import { useState } from 'react'
import type { WeddingEvent } from '../config/wedding-config'

function directionsUrl(event: WeddingEvent): string {
  return (
    event.mapsUrl ??
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.address)}`
  )
}

function embedUrl(event: WeddingEvent): string {
  return (
    event.mapsEmbedUrl ??
    `https://www.google.com/maps?q=${encodeURIComponent(event.address)}&output=embed`
  )
}

interface EventCardProps {
  event: WeddingEvent
}

export function EventCard({ event }: EventCardProps) {
  // Iframe bản đồ nặng: chỉ gắn vào DOM sau khi khách chủ động bấm.
  const [showMap, setShowMap] = useState(false)

  return (
    <article className="card event-card">
      <h4 className="event-title">{event.title}</h4>
      <p className="event-time">
        {event.time} · {event.date}
      </p>
      <p className="event-venue">{event.venue}</p>
      <p className="event-address">{event.address}</p>
      <div className="row">
        <a className="btn" href={directionsUrl(event)} target="_blank" rel="noopener noreferrer">
          Chỉ đường
        </a>
        <button
          type="button"
          className="btn btn-ghost"
          aria-expanded={showMap}
          aria-controls={`map-${event.id}`}
          onClick={() => setShowMap((v) => !v)}
        >
          {showMap ? 'Ẩn bản đồ' : 'Xem bản đồ'}
        </button>
      </div>
      {showMap && (
        <iframe
          id={`map-${event.id}`}
          className="map-frame"
          title={`Bản đồ: ${event.venue}`}
          src={embedUrl(event)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      )}
    </article>
  )
}
