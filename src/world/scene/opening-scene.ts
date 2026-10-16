import { COUPLE_CUTOUT_URL } from '../world-config'
import { createPaperHills } from './paper-hills'
import { createPaperLayer, type PaperLayer } from './paper-layer'
import { createPaperPetals, type PaperPetals } from './paper-petals'
import type { FrameState, SceneContext, SceneModule } from './scene-module'

/** Chiều cao hình cặp đôi trong đơn vị thế giới; chân đứng ở y = 0. */
const COUPLE_HEIGHT = 5.6
/** Số cánh hoa tối đa cấp bộ nhớ; số hiển thị theo tier chất lượng. */
const MAX_PETALS = 120

/**
 * Cảnh mở đầu theo ba khoảng cách Z:
 * - hậu cảnh: ba dải đồi giấy mint (z -16 → -6) có sương mù;
 * - trung cảnh: cặp đôi (z 0), hình cắt giấy có viền trắng và bóng đổ;
 * - tiền cảnh: cánh hoa giấy rơi, bay qua mọi khoảng cách trong thể tích cảnh.
 * Gallery ảnh tương tác sẽ thêm vào trung cảnh ở bước sau.
 */
export function createOpeningScene(): SceneModule {
  const hills = createPaperHills()
  const petals: PaperPetals = createPaperPetals(MAX_PETALS)
  let couple: PaperLayer | null = null
  let context: SceneContext | null = null

  return {
    async init(ctx) {
      context = ctx
      const texture = await ctx.loader.loadAsync(COUPLE_CUTOUT_URL)
      texture.anisotropy = Math.min(4, ctx.maxAnisotropy)
      couple = createPaperLayer({ texture, height: COUPLE_HEIGHT })
      couple.object.position.set(0, COUPLE_HEIGHT / 2, 0)
      ctx.scene.add(hills.object, couple.object, petals.object)
      petals.setCount(ctx.tier.petals)
    },
    update(frame: FrameState) {
      petals.setTime(frame.time)
    },
    applyQuality(tier) {
      petals.setCount(tier.petals)
    },
    dispose() {
      context?.scene.remove(hills.object, petals.object)
      if (couple) context?.scene.remove(couple.object)
      couple?.dispose()
      hills.dispose()
      petals.dispose()
    },
  }
}
