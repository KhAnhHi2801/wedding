import { weddingConfig } from '../config/wedding-config'
import type { Invite } from '../lib/url-params'
import type { Chapter } from '../world/chapters'
import { CHAPTER_COPY } from './chapter-copy'

interface ChapterSectionProps {
  chapter: Chapter
  invite: Invite
  /** Chương mở đầu là `<h1>` của trang, các chương khác là `<h2>`. */
  isOpening: boolean
}

/**
 * Một chương của trang: vùng cuộn cao hơn màn hình, bên trong là khối chữ dính (sticky) ở giữa màn hình.
 * Mọi chữ là HTML phẳng nằm trên canvas; canvas không chứa chữ nào.
 */
export function ChapterSection({ chapter, invite, isOpening }: ChapterSectionProps) {
  const { couple, dateLabel, dateIso } = weddingConfig
  const copy = CHAPTER_COPY[chapter.id]

  return (
    <section id={chapter.id} className='chapter' aria-labelledby={`${chapter.id}-title`}>
      <div className='chapter__stage'>
        {isOpening ? (
          <div className='chapter__copy'>
            {invite.guestName ? <p className='chapter__kicker'>Thân mời {invite.guestName}</p> : null}
            <h1 id={`${chapter.id}-title`} className='chapter__title chapter__title--names'>
              <span translate='no'>{couple.bride}</span>
              <span className='chapter__amp' aria-hidden='true'>
                &
              </span>
              <span translate='no'>{couple.groom}</span>
            </h1>
            <p className='chapter__body'>
              <time dateTime={dateIso}>{dateLabel}</time>
            </p>
            {/* Thông tin cần nhất không bắt khách đi hết cảnh 3D mới thấy. */}
            <a className='chapter__cta' href='#thong-tin'>
              Xem giờ & địa điểm
            </a>
          </div>
        ) : (
          <div className='chapter__copy'>
            <p className='chapter__kicker'>{copy.kicker}</p>
            <h2 id={`${chapter.id}-title`} className='chapter__title'>
              {copy.title}
            </h2>
            <p className='chapter__body'>{copy.body}</p>
          </div>
        )}
      </div>
    </section>
  )
}
