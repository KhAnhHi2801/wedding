import { EventCard } from '../components/event-card'
import { weddingConfig } from '../config/wedding-config'
import type { Side } from '../lib/url-params'

interface InfoSectionProps {
  /** Phía nhà khách được mời qua ?nha; null = hiện cả hai nhà. */
  side: Side | null
}

const SIDES: readonly Side[] = ['trai', 'gai']

/**
 * Giờ, địa điểm và chỉ đường dưới dạng HTML thường, nằm sau các chương 3D. Khách vào thẳng bằng nút ở màn hình đầu
 * hoặc `#thong-tin`, và đọc được cả khi WebGL tắt. Có nền giấy đặc nên che canvas phía sau.
 */
export function InfoSection({ side }: InfoSectionProps) {
  const { events, groupTitles } = weddingConfig
  const groups = SIDES.filter((candidate) => side === null || candidate === side)

  return (
    <section id='thong-tin' className='info' aria-labelledby='thong-tin-title'>
      <div className='info__inner'>
        <h2 id='thong-tin-title' className='info__title'>
          Giờ & địa điểm
        </h2>
        {groups.map((group) => (
          <div key={group} className='info__group'>
            <h3 className='info__group-title'>{groupTitles[group]}</h3>
            <div className='info__cards'>
              {events
                .filter((event) => event.side === group)
                .map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
