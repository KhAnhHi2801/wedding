export type Vec3 = readonly [number, number, number]

export interface Chapter {
  /** Dùng làm anchor `#id` và khoá nội dung HTML. */
  id: string
  label: string
  /** Tiến độ cuộn (0..1) tại đó camera đúng tư thế của chương. */
  start: number
  camera: Vec3
  target: Vec3
  fog: { color: string; near: number; far: number }
}

const definitions: readonly Omit<Chapter, 'start'>[] = [
  {
    id: 'mo-dau',
    label: 'Mở đầu',
    camera: [0, 2, 11],
    target: [0, 2.2, 0],
    fog: { color: '#eaf6f0', near: 14, far: 42 },
  },
  {
    id: 'cau-chuyen',
    label: 'Câu chuyện',
    camera: [-3, 2.2, 7.5],
    target: [0, 2.4, -2],
    fog: { color: '#e2f2ea', near: 12, far: 36 },
  },
  {
    id: 'khoanh-khac',
    label: 'Khoảnh khắc',
    camera: [-4.5, 2.4, 0.5],
    target: [-1, 2.6, -10],
    fog: { color: '#f2eee2', near: 10, far: 30 },
  },
]

/** Các chương chia đều chiều cao cuộn; mỗi chương một `<section>` cao bằng nhau trong HTML. */
export const CHAPTERS: readonly Chapter[] = definitions.map((chapter, index) => ({
  ...chapter,
  start: index / definitions.length,
}))

/** Chỉ số chương có `start` lớn nhất không vượt `progress` (tìm nhị phân, không rẽ nhánh theo tên chương). */
export function findChapterIndex(progress: number, chapters: readonly Chapter[] = CHAPTERS): number {
  let low = 0
  let high = chapters.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (chapters[mid].start <= progress) low = mid
    else high = mid - 1
  }
  return low
}
