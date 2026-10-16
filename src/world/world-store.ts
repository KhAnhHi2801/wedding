import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { prefersReducedMotion } from '../lib/motion-preference'
import { pickInitialTier, type QualityTierId } from './quality-tier'

export type WorldStatus = 'loading' | 'ready' | 'unsupported' | 'lost'

export interface WorldState {
  status: WorldStatus
  /** Chương đang hiển thị; chỉ đổi khi sang chương khác nên HTML không render lại mỗi khung hình. */
  chapterIndex: number
  tierId: QualityTierId
  reducedMotion: boolean
  /** Khách bấm tạm dừng hoa rơi. */
  paused: boolean
  setStatus: (status: WorldStatus) => void
  setChapterIndex: (index: number) => void
  setTier: (id: QualityTierId) => void
  setReducedMotion: (value: boolean) => void
  setPaused: (value: boolean) => void
}

/**
 * Store vanilla: vòng render đọc bằng `worldStore.getState()` nên không kích hoạt React.
 * Giá trị đổi mỗi khung (tiến độ đã làm mượt, vị trí camera) nằm trong engine, không vào store.
 */
export const worldStore = createStore<WorldState>()((set, get) => ({
  status: 'loading',
  chapterIndex: 0,
  tierId: pickInitialTier().id,
  reducedMotion: prefersReducedMotion(),
  paused: false,
  setStatus: (status) => set({ status }),
  setChapterIndex: (chapterIndex) => {
    if (get().chapterIndex !== chapterIndex) set({ chapterIndex })
  },
  setTier: (tierId) => set({ tierId }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setPaused: (paused) => set({ paused }),
}))

export const useWorld = <T>(selector: (state: WorldState) => T): T => useStore(worldStore, selector)
