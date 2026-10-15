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

const PETALS = 5
const PETAL_SEGMENTS = 12

/**
 * Bông hoa năm cánh nhìn thẳng: mỗi cánh là một hình elip tô gradient từ gốc hơi xám tới mép trắng, ở giữa là nhụy vàng.
 * Màu thật từng bông do màu theo instance nhân vào (trắng, kem, hồng nhạt, tím oải hương).
 */
export function createFlowerGeometry(): BufferGeometry {
  const data: MeshData = { positions: [], colors: [], indices: [] }
  const root = new Color('#e1d8d2')
  const rim = new Color('#ffffff')
  const mix = new Color()
  const centerLength = 0.234
  const radiusX = 0.14
  const radiusY = 0.24

  for (let petal = 0; petal < PETALS; petal += 1) {
    const angle = (petal * Math.PI * 2) / PETALS
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    // Mỗi cánh nhích một chút theo độ sâu để các cánh chồng lên nhau ở gốc không bị chập chờn (z-fighting).
    const z = petal * 0.002
    const place = (x: number, y: number) => [x * cos - y * sin, x * sin + y * cos] as const

    const [rx, ry] = place(0, 0.03)
    const rootIndex = addVertex(data, rx, ry, z, root)
    const ring: number[] = []
    for (let i = 0; i < PETAL_SEGMENTS; i += 1) {
      const t = (i / PETAL_SEGMENTS) * Math.PI * 2
      const px = Math.cos(t) * radiusX
      const py = centerLength + Math.sin(t) * radiusY
      // Càng xa gốc càng trắng.
      mix.copy(root).lerp(rim, Math.min(1, py / (centerLength + radiusY)))
      const [x, y] = place(px, py)
      ring.push(addVertex(data, x, y, z, mix))
    }
    for (let i = 0; i < PETAL_SEGMENTS; i += 1) {
      data.indices.push(rootIndex, ring[i], ring[(i + 1) % PETAL_SEGMENTS])
    }
  }

  // Nhụy: đĩa tròn vàng, đặt trước các cánh.
  const heartInner = new Color('#d9b45a')
  const heartOuter = new Color('#f0d68a')
  const centre = addVertex(data, 0, 0, 0.02, heartInner)
  const heartRing: number[] = []
  for (let i = 0; i < 10; i += 1) {
    const t = (i / 10) * Math.PI * 2
    heartRing.push(addVertex(data, Math.cos(t) * 0.06, Math.sin(t) * 0.06, 0.02, heartOuter))
  }
  for (let i = 0; i < 10; i += 1) data.indices.push(centre, heartRing[i], heartRing[(i + 1) % 10])

  return toGeometry(data)
}

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
