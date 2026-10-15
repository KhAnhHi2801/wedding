import { BufferGeometry, Color, Float32BufferAttribute } from 'three'

/**
 * Hoa và lá dựng bằng hình học thật (đa giác tô màu theo đỉnh) thay vì ảnh texture cắt alpha. Mép đa giác được GPU khử
 * răng cưa chuẩn (mịn ở mọi cỡ, kể cả khi phóng to), không có viền chấm dither/alpha, không bị rìa đen do texture, và vẽ
 * rẻ hơn nhiều trên điện thoại vì không cần `discard` từng pixel. Mỗi hình nằm gọn trong hình vuông đơn vị
 * [-0.5, 0.5]², cùng quy ước kích thước với mặt phẳng 1×1 trước đây.
 */

interface MeshData {
  positions: number[]
  colors: number[]
  indices: number[]
}

const addVertex = (data: MeshData, x: number, y: number, z: number, color: Color): number => {
  data.positions.push(x, y, z)
  data.colors.push(color.r, color.g, color.b)
  return data.positions.length / 3 - 1
}

const toGeometry = ({ positions, colors, indices }: MeshData): BufferGeometry => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  return geometry
}

interface RadialFlower {
  petals: number
  /** Số đoạn của đa giác elip mỗi cánh. */
  segments: number
  /** Khoảng cách từ tâm hoa tới tâm cánh, và bán kính elip của cánh (theo hướng ngang, dọc). */
  distance: number
  radiusX: number
  radiusY: number
  /** Màu gốc cánh (gần nhụy) và màu mép cánh; gradient theo khoảng cách. */
  root: string
  rim: string
  /** Nhụy: bán kính và hai màu (tâm, mép). */
  heartRadius: number
  heartInner: string
  heartOuter: string
}

/** Bông hoa nhìn thẳng gồm các cánh elip xếp tròn quanh một nhụy; mọi loại hoa tròn dưới đây là biến thể của hàm này. */
function createRadialFlower(spec: RadialFlower): BufferGeometry {
  const data: MeshData = { positions: [], colors: [], indices: [] }
  const root = new Color(spec.root)
  const rim = new Color(spec.rim)
  const mix = new Color()
  const reach = spec.distance + spec.radiusY

  for (let petal = 0; petal < spec.petals; petal += 1) {
    const angle = (petal * Math.PI * 2) / spec.petals
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    // Mỗi cánh nhích một chút theo độ sâu để các cánh chồng lên nhau ở gốc không bị chập chờn (z-fighting).
    const z = petal * 0.002
    const place = (x: number, y: number) => [x * cos - y * sin, x * sin + y * cos] as const

    const [rx, ry] = place(0, spec.distance * 0.12)
    const rootIndex = addVertex(data, rx, ry, z, root)
    const ring: number[] = []
    for (let i = 0; i < spec.segments; i += 1) {
      const t = (i / spec.segments) * Math.PI * 2
      const px = Math.cos(t) * spec.radiusX
      const py = spec.distance + Math.sin(t) * spec.radiusY
      // Càng xa gốc càng về màu mép.
      mix.copy(root).lerp(rim, Math.min(1, Math.max(0, py / reach)))
      const [x, y] = place(px, py)
      ring.push(addVertex(data, x, y, z, mix))
    }
    for (let i = 0; i < spec.segments; i += 1) {
      data.indices.push(rootIndex, ring[i], ring[(i + 1) % spec.segments])
    }
  }

  // Nhụy: đĩa tròn đặt trước các cánh.
  const centre = addVertex(data, 0, 0, 0.02, new Color(spec.heartInner))
  const heartOuter = new Color(spec.heartOuter)
  const heartRing: number[] = []
  for (let i = 0; i < 10; i += 1) {
    const t = (i / 10) * Math.PI * 2
    heartRing.push(addVertex(data, Math.cos(t) * spec.heartRadius, Math.sin(t) * spec.heartRadius, 0.02, heartOuter))
  }
  for (let i = 0; i < 10; i += 1) data.indices.push(centre, heartRing[i], heartRing[(i + 1) % 10])
  return toGeometry(data)
}

/** Hoa năm cánh trắng ngà, nhụy vàng; màu thật từng bông do màu theo instance nhân vào (trắng, kem, hồng nhạt, tím). */
export const createFlowerGeometry = (): BufferGeometry =>
  createRadialFlower({
    petals: 5,
    segments: 12,
    distance: 0.234,
    radiusX: 0.14,
    radiusY: 0.24,
    root: '#e1d8d2',
    rim: '#ffffff',
    heartRadius: 0.06,
    heartInner: '#d9b45a',
    heartOuter: '#f0d68a',
  })

/** Hoa cúc: nhiều cánh nhỏ dài màu trắng, nhụy vàng to. */
export const createDaisyGeometry = (): BufferGeometry =>
  createRadialFlower({
    petals: 12,
    segments: 8,
    distance: 0.29,
    radiusX: 0.045,
    radiusY: 0.19,
    root: '#f4efe4',
    rim: '#ffffff',
    heartRadius: 0.11,
    heartInner: '#e8a93a',
    heartOuter: '#f6cf59',
  })

/** Hoa anh túc: bốn cánh tròn rộng màu đỏ san hô, nhụy sẫm. */
export const createPoppyGeometry = (): BufferGeometry =>
  createRadialFlower({
    petals: 4,
    segments: 12,
    distance: 0.21,
    radiusX: 0.2,
    radiusY: 0.22,
    root: '#d2584a',
    rim: '#f4a597',
    heartRadius: 0.06,
    heartInner: '#2f2326',
    heartOuter: '#4a3a3e',
  })

/** Hoa lưu ly: năm cánh tròn nhỏ màu xanh da trời, nhụy vàng. */
export const createForgetMeNotGeometry = (): BufferGeometry =>
  createRadialFlower({
    petals: 5,
    segments: 10,
    distance: 0.2,
    radiusX: 0.13,
    radiusY: 0.14,
    root: '#6fa8dc',
    rim: '#b9dcf7',
    heartRadius: 0.06,
    heartInner: '#f2b632',
    heartOuter: '#f7d675',
  })

const LEAF_ROWS = 8

/**
 * Chiếc lá thon, hai đầu nhọn, gân giữa sáng hơn hai mép. Cao 1 (trục y) và rộng 1 (trục x), khi dùng thường thu hẹp
 * bề ngang còn nửa chiều cao.
 */
export function createLeafGeometry(): BufferGeometry {
  const data: MeshData = { positions: [], colors: [], indices: [] }
  const edge = new Color('#5f8f63')
  const rib = new Color('#a3c9a0')
  const rows: Array<[number, number, number]> = []
  for (let i = 0; i <= LEAF_ROWS; i += 1) {
    const t = i / LEAF_ROWS
    const y = -0.5 + t
    const half = 0.5 * (4 * t * (1 - t)) ** 0.7
    rows.push([
      addVertex(data, -half, y, 0, edge),
      addVertex(data, 0, y, 0, rib),
      addVertex(data, half, y, 0, edge),
    ])
  }
  for (let i = 0; i < LEAF_ROWS; i += 1) {
    const [l0, m0, r0] = rows[i]
    const [l1, m1, r1] = rows[i + 1]
    data.indices.push(l0, m0, l1, m0, m1, l1, m0, r0, m1, r0, r1, m1)
  }
  return toGeometry(data)
}


/** Một mảng elip (đa giác quạt) tô gradient từ tâm ra mép, thêm vào dữ liệu hình. */
function addEllipse(
  data: MeshData,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  z: number,
  inner: Color,
  outer: Color,
  segments = 12,
) {
  const centre = addVertex(data, cx, cy, z, inner)
  const ring: number[] = []
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2
    ring.push(addVertex(data, cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, z, outer))
  }
  for (let i = 0; i < segments; i += 1) data.indices.push(centre, ring[i], ring[(i + 1) % segments])
}

/**
 * Con bướm nhìn thẳng từ phía trước: hai cánh trên to, hai cánh dưới nhỏ, thân nhỏ sẫm ở giữa, đối xứng qua trục y.
 * Cánh tô sáng ở gốc, nhạt dần ra mép; màu thật do màu theo instance nhân vào. Vỗ cánh = co bề ngang trong shader.
 */
export function createButterflyGeometry(): BufferGeometry {
  const data: MeshData = { positions: [], colors: [], indices: [] }
  const inner = new Color('#ffffff')
  const outer = new Color('#f1dce6')
  for (const side of [-1, 1]) {
    addEllipse(data, side * 0.24, 0.17, 0.25, 0.2, 0, inner, outer)
    addEllipse(data, side * 0.18, -0.14, 0.17, 0.15, 0.001, inner, outer)
  }
  // Thân: dải đứng mảnh, đặt trước cánh.
  const body = new Color('#3b2a2d')
  const a = addVertex(data, -0.022, -0.22, 0.01, body)
  const b = addVertex(data, 0.022, -0.22, 0.01, body)
  const c = addVertex(data, -0.022, 0.22, 0.01, body)
  const d = addVertex(data, 0.022, 0.22, 0.01, body)
  data.indices.push(a, b, c, b, d, c)
  return toGeometry(data)
}

/**
 * Chú ong nhìn nghiêng: thân bầu dục sọc vàng đen và hai cánh nhỏ nhạt phía trên. Cánh nằm ở y > 0.08 để shader nhận ra
 * và làm chúng rung nhanh.
 */
export function createBeeGeometry(): BufferGeometry {
  const data: MeshData = { positions: [], colors: [], indices: [] }
  const yellow = new Color('#f6c445')
  const black = new Color('#3b2a2d')
  const bands = [yellow, yellow, black, black, yellow, yellow, black, black, yellow, yellow, yellow, yellow]
  const columns = bands.length
  const halfLength = 0.17
  const halfHeight = 0.11
  const rows: Array<[number, number]> = []
  for (let i = 0; i < columns; i += 1) {
    const x = -halfLength + (2 * halfLength * i) / (columns - 1)
    const h = halfHeight * Math.sqrt(Math.max(0.05, 1 - (x / halfLength) ** 2))
    rows.push([addVertex(data, x, -h, 0, bands[i]), addVertex(data, x, h, 0, bands[i])])
  }
  for (let i = 0; i < columns - 1; i += 1) {
    const [b0, t0] = rows[i]
    const [b1, t1] = rows[i + 1]
    data.indices.push(b0, b1, t0, b1, t1, t0)
  }
  const wingInner = new Color('#ffffff')
  const wingOuter = new Color('#d7e9fb')
  addEllipse(data, -0.04, 0.2, 0.07, 0.11, 0.01, wingInner, wingOuter, 8)
  addEllipse(data, 0.05, 0.19, 0.06, 0.1, 0.011, wingInner, wingOuter, 8)
  // Mắt nhỏ.
  addEllipse(data, halfLength - 0.03, 0.03, 0.02, 0.02, 0.012, black, black, 6)
  return toGeometry(data)
}
