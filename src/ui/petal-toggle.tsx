import { useWorld, worldStore } from '../world/world-store'

/**
 * Hoa rơi tự chạy lâu hơn 5 giây nên cần nút tạm dừng riêng. Khi hệ điều hành đã bật "giảm chuyển động" thì hoa đứng yên
 * sẵn, nút không có việc gì để làm nên ẩn đi thay vì hiện một nút bị khóa.
 */
export function PetalToggle() {
  const paused = useWorld((state) => state.paused)
  const reducedMotion = useWorld((state) => state.reducedMotion)
  if (reducedMotion) return null

  return (
    <button type='button' className='petal-toggle' aria-pressed={paused} onClick={() => worldStore.getState().setPaused(!paused)}>
      {paused ? 'Phát hoa rơi' : 'Tạm dừng hoa rơi'}
    </button>
  )
}
