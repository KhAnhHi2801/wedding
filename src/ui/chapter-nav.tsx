import { CHAPTERS } from '../world/chapters'
import { useWorld } from '../world/world-store'

/** Điều hướng chương: liên kết `#id` thật (Cmd/Ctrl-click, deep link), chương đang xem có `aria-current`. */
export function ChapterNav() {
  const current = useWorld((state) => state.chapterIndex)

  return (
    <nav className='chapter-nav' aria-label='Các chương'>
      <ol>
        {CHAPTERS.map((chapter, index) => (
          <li key={chapter.id}>
            <a href={`#${chapter.id}`} aria-current={index === current ? 'step' : undefined}>
              <span className='chapter-nav__dot' aria-hidden='true' />
              <span className='chapter-nav__label'>{chapter.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
