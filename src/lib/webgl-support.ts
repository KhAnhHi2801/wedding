let cached: boolean | undefined

/** Thử tạo context WebGL một lần rồi nhả ngay để không chiếm chỗ trong giới hạn context của trình duyệt. */
export function probeWebgl(): boolean {
  if (cached !== undefined) return cached
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    cached = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
