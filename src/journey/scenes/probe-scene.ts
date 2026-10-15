import { Color, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three'
import type { SceneContext, SceneModule } from '../scene-module'

const BLOOM_PINK = 0xe7a3ae

/**
 * Cảnh thử của phase nền tảng: một dãy quả cầu dọc đường camera để kiểm tra camera bay theo cuộn, bậc chất lượng và
 * việc dọn dẹp. Các cảnh thật (cổng, vườn, đường ảnh, hoàng hôn) thay thế cảnh này ở các phase sau.
 */
export function createProbeScene(): SceneModule {
  const group = new Group()
  const geometry = new SphereGeometry(0.35, 16, 12)
  const materials: MeshBasicMaterial[] = []
  let ctx: SceneContext | null = null

  const rebuild = (density: number) => {
    group.clear()
    materials.splice(0).forEach((material) => material.dispose())
    if (!ctx) return
    const count = Math.max(6, Math.round(40 * density))
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1)
      const point = ctx.path.getPointAt(t)
      const side = i % 2 === 0 ? -1 : 1
      const material = new MeshBasicMaterial({ color: new Color(BLOOM_PINK).offsetHSL(t * 0.12, 0, 0) })
      materials.push(material)
      const mesh = new Mesh(geometry, material)
      mesh.position.set(point.x + side * 2.2, point.y - 0.6, point.z)
      group.add(mesh)
    }
  }

  return {
    id: 'probe',
    init(context) {
      ctx = context
      context.scene.add(group)
      rebuild(context.settings.density)
    },
    update() {},
    setQuality(_tier, settings) {
      rebuild(settings.density)
      ctx?.invalidate()
    },
    dispose() {
      ctx?.scene.remove(group)
      group.clear()
      materials.splice(0).forEach((material) => material.dispose())
      geometry.dispose()
      ctx = null
    },
  }
}
