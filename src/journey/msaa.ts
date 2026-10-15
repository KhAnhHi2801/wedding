import type { WebGLRenderer } from 'three'

/**
 * Khung vẽ có thật sự khử răng cưa đa mẫu (MSAA) không. Khác với việc "đã xin antialias": trình duyệt có thể từ chối.
 * Cần biết để bật `alphaToCoverage` đúng chỗ: có MSAA thì mép hoa/lá mịn, không có thì nó rải mép thành các chấm.
 */
export function hasMsaa(renderer: WebGLRenderer): boolean {
  const gl = renderer.getContext()
  return (gl.getParameter(gl.SAMPLES) as number) > 0
}
