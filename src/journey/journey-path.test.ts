import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { createJourneyPath, JOURNEY_DEPTH } from './journey-path'

const SAMPLES = 200

describe('createJourneyPath', () => {
  it('đi từ cổng vào (z dương) tới cổng kết (z âm) và đoạn đường dài bằng JOURNEY_DEPTH', () => {
    const path = createJourneyPath()
    const start = path.getPointAt(0)
    const end = path.getPointAt(1)
    expect(start.z).toBeGreaterThan(0)
    expect(end.z).toBeLessThan(0)
    expect(start.z - end.z).toBeCloseTo(JOURNEY_DEPTH, 0)
  })

  it('z giảm đơn điệu dọc đường: camera không bao giờ quay ngược lại', () => {
    const path = createJourneyPath()
    let prevZ = Infinity
    for (let i = 0; i <= SAMPLES; i += 1) {
      const z = path.getPointAt(i / SAMPLES).z
      expect(z).toBeLessThanOrEqual(prevZ + 1e-9)
      prevZ = z
    }
  })

  it('getPointAt và getTangentAt luôn hữu hạn ở đầu, cuối và giữa', () => {
    const path = createJourneyPath()
    const point = new Vector3()
    const tangent = new Vector3()
    for (const t of [0, 0.5, 1]) {
      path.getPointAt(t, point)
      path.getTangentAt(t, tangent)
      for (const v of [point, tangent]) {
        expect(Number.isFinite(v.x)).toBe(true)
        expect(Number.isFinite(v.y)).toBe(true)
        expect(Number.isFinite(v.z)).toBe(true)
      }
      expect(tangent.length()).toBeGreaterThan(0)
    }
  })

  it('tiếp tuyến hướng về phía trước (z giảm) ở mọi điểm, để camera nhìn vào trong', () => {
    const path = createJourneyPath()
    for (let i = 0; i <= SAMPLES; i += 1) {
      expect(path.getTangentAt(i / SAMPLES).z).toBeLessThan(0)
    }
  })
})
