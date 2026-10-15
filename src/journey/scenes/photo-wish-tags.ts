import { CanvasTexture, CircleGeometry, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import { ARCH_HEIGHT, ARCH_WIDTH } from './photo-arch-geometry'

/** Tối đa bấy nhiêu thẻ nơ treo trên mỗi vòm ảnh; thẻ đọc phía dưới xoay hết các lời chúc của ảnh. */
export const MAX_TAGS = 3
const CARD = new Color('#fbf3e6')
/** Thẻ đã có ảnh chữ: màu vật liệu chỉ nhân lên (trắng = giữ nguyên), thẻ đang đọc ngả hồng. */
const WHITE = new Color('#ffffff')
const CARD_ACTIVE = new Color('#ffdce4')
const RIBBON = new Color('#b76e79')

/** Điểm treo (hệ tọa độ khung): hai bên cung trên và một bên cạnh thấp, tránh che mặt người ở giữa ảnh. */
const ARC_Y = ARCH_HEIGHT - ARCH_WIDTH / 2
const SLOTS: ReadonlyArray<readonly [x: number, y: number]> = [
  [-ARCH_WIDTH * 0.43, ARC_Y + ARCH_WIDTH * 0.2],
  [ARCH_WIDTH * 0.45, ARC_Y + ARCH_WIDTH * 0.1],
  [-ARCH_WIDTH * 0.52, ARC_Y * 0.45],
]

interface Tag {
  pivot: Group
  cardMaterial: MeshBasicMaterial
  phase: number
  name: string
  texture: CanvasTexture | null
}

/** Vẽ tên người chúc lên thẻ giấy kem: viền mảnh, chữ serif nghiêng, như thẻ tên trên quà cưới. */
function drawTag(name: string): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 170
  const g = canvas.getContext('2d')
  if (g) {
    g.fillStyle = '#fbf3e6'
    g.fillRect(0, 0, 256, 170)
    g.strokeStyle = '#d9b9a8'
    g.lineWidth = 3
    g.strokeRect(10, 10, 236, 150)
    g.fillStyle = '#7a4a52'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = 'italic 500 44px "Playfair Display", Georgia, serif'
    g.fillText(name.length > 9 ? `${name.slice(0, 8)}…` : name, 128, 88)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export interface WishTags {
  group: Group
  /** `count` thẻ đầu hiện ra; thẻ thứ `activeIndex` (nếu có) to hơn và hồng hơn. */
  update: (names: readonly string[], activeIndex: number, opacity: number, seconds: number) => void
  dispose: () => void
}

/**
 * Thẻ giấy kem buộc nơ hồng treo trên vòm hoa, đung đưa như đồ trang trí cưới. Chỉ là tín hiệu "ảnh này có lời chúc":
 * chữ đọc ở thẻ HTML phía dưới màn hình để rõ nét và đọc được bằng trình đọc màn hình.
 */
export function createWishTags(): WishTags {
  const cardGeometry = new PlaneGeometry(0.36, 0.24)
  const cordGeometry = new PlaneGeometry(0.014, 0.16)
  const knotGeometry = new CircleGeometry(0.045, 14)
  const ribbonMaterial = new MeshBasicMaterial({ color: RIBBON, fog: false })
  const group = new Group()
  const tags: Tag[] = SLOTS.slice(0, MAX_TAGS).map(([x, y], i) => {
    const pivot = new Group()
    pivot.position.set(x, y, 0.1)
    const cardMaterial = new MeshBasicMaterial({ color: CARD.clone(), transparent: true, fog: false })
    const card = new Mesh(cardGeometry, cardMaterial)
    card.position.y = -0.16 - 0.12
    const cord = new Mesh(cordGeometry, ribbonMaterial)
    cord.position.y = -0.08
    const knot = new Mesh(knotGeometry, ribbonMaterial)
    knot.position.set(0, -0.17, 0.01)
    pivot.add(cord, card, knot)
    pivot.visible = false
    group.add(pivot)
    return { pivot, cardMaterial, phase: i * 2.1, name: '', texture: null }
  })

  return {
    group,
    update(names, activeIndex, opacity, seconds) {
      tags.forEach((tag, i) => {
        const shown = i < names.length && opacity > 0.01
        tag.pivot.visible = shown
        if (!shown) return
        // Chỉ vẽ lại thẻ khi tên đổi (không mỗi khung hình).
        if (names[i] !== tag.name) {
          tag.name = names[i]
          tag.texture?.dispose()
          tag.texture = drawTag(tag.name)
          tag.cardMaterial.map = tag.texture
          tag.cardMaterial.color.set('#ffffff')
          tag.cardMaterial.needsUpdate = true
        }
        const active = i === activeIndex
        tag.pivot.rotation.z = Math.sin(seconds * 1.1 + tag.phase) * (active ? 0.2 : 0.12)
        tag.pivot.scale.setScalar(active ? 1.3 : 1)
        tag.cardMaterial.color.copy(active ? CARD_ACTIVE : WHITE)
        tag.cardMaterial.opacity = opacity
      })
    },
    dispose() {
      cardGeometry.dispose()
      cordGeometry.dispose()
      knotGeometry.dispose()
      ribbonMaterial.dispose()
      tags.forEach((tag) => {
        tag.texture?.dispose()
        tag.cardMaterial.dispose()
      })
    },
  }
}
