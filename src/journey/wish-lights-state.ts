import { hashId } from '../lib/wish-position'

/**
 * Cầu nối giữa lớp HTML (thẻ lời chúc, form gửi) và cảnh album 3D. Một đối tượng thường thay vì React state vì cảnh 3D
 * đọc ngoài vòng đời React; HTML dùng `subscribe` (useSyncExternalStore) để theo dõi.
 * Mỗi lời chúc gắn vào một ảnh theo `hash(id) % số ảnh` (ổn định khi tải lại); lời chúc vừa gửi thì gắn vào ảnh khách
 * đang xem trong phiên đó.
 */
export interface LightWish {
  id: string
  name: string
  message: string
}

type Listener = () => void

let wishes: readonly LightWish[] = []
let activeId: string | null = null
let photoIndex = 0
let photoCount = 1
const bornPhotos = new Map<string, number>()
const listeners = new Set<Listener>()
const emit = () => listeners.forEach((listener) => listener())

/** Chỉ số ảnh mà lời chúc này gắn vào. */
const photoFor = (id: string): number => bornPhotos.get(id) ?? hashId(id) % Math.max(photoCount, 1)

/** Danh sách lời chúc của một ảnh; cache theo (danh sách, số ảnh, chỉ số) để useSyncExternalStore có snapshot ổn định. */
const cache = new Map<number, { source: readonly LightWish[]; count: number; bornSize: number; list: LightWish[] }>()
const wishesOfPhoto = (index: number): readonly LightWish[] => {
  const hit = cache.get(index)
  if (hit && hit.source === wishes && hit.count === photoCount && hit.bornSize === bornPhotos.size) return hit.list
  const list = wishes.filter((wish) => photoFor(wish.id) === index)
  cache.set(index, { source: wishes, count: photoCount, bornSize: bornPhotos.size, list })
  return list
}

export const wishLights = {
  getWishes: (): readonly LightWish[] => wishes,
  getActiveId: (): string | null => activeId,
  getPhotoIndex: (): number => photoIndex,
  wishesOfPhoto,
  setPhotoCount(count: number) {
    if (count === photoCount) return
    photoCount = count
    emit()
  },
  setWishes(next: readonly LightWish[]) {
    wishes = next
    emit()
  },
  setActive(id: string | null) {
    if (id === activeId) return
    activeId = id
    emit()
  },
  /** Cảnh báo ảnh đang ở giữa khung: thẻ lời chúc chuyển sang lời chúc của ảnh đó. */
  setPhoto(index: number) {
    if (index === photoIndex) return
    photoIndex = index
    emit()
  },
  /** Lời chúc vừa gửi: gắn vào ảnh đang xem và chọn làm lời chúc hiện tại. */
  markBorn(id: string) {
    bornPhotos.set(id, photoIndex)
    activeId = id
    emit()
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
