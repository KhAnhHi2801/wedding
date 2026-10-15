import { CatmullRomCurve3, Vector3 } from 'three'

/** Chiều dài tham chiếu của hành trình (đơn vị thế giới); các cảnh dựa vào để đặt vật thể theo tỉ lệ. */
export const JOURNEY_DEPTH = 100

/**
 * Điểm camera đi qua, từ cổng (z dương, nhìn vào) tới cổng kết. Đường uốn nhẹ trái phải và nhích cao dần
 * để mỗi chặng có góc nhìn khác nhau. Các cảnh sau có thể tinh chỉnh điểm neo của chặng mình.
 */
const ANCHORS: ReadonlyArray<readonly [x: number, y: number, z: number]> = [
  [0, 1.6, 8],
  [0, 1.6, 0],
  [1.2, 1.5, -16],
  [-1.2, 1.6, -34],
  [0.8, 1.8, -54],
  [0, 2.2, -74],
  [0, 2.6, -92],
]

export function createJourneyPath(): CatmullRomCurve3 {
  return new CatmullRomCurve3(
    ANCHORS.map(([x, y, z]) => new Vector3(x, y, z)),
    false,
    'centripetal',
  )
}
