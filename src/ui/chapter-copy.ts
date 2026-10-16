export interface ChapterCopy {
  kicker: string
  title: string
  body: string
}

/**
 * Nội dung chữ của từng chương, khoá theo `Chapter.id`. Chương mở đầu lấy tên và ngày từ `wedding-config.ts`
 * (xem `ChapterSection`), các chương còn lại là chỗ giữ chỗ cho tới khi storyboard được duyệt.
 */
export const CHAPTER_COPY: Record<string, ChapterCopy> = {
  'cau-chuyen': {
    kicker: 'Câu chuyện',
    title: 'Chúng mình đã đi cùng nhau như thế',
    body: 'Phần kể chuyện sẽ được viết theo giọng của hai bạn.',
  },
  'khoanh-khac': {
    kicker: 'Khoảnh khắc',
    title: 'Những khoảnh khắc nhỏ',
    body: 'Phần ảnh và lời chúc sẽ nằm ở đây.',
  },
}
