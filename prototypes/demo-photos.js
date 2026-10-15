// Ảnh mẫu vẽ bằng canvas (bầu trời, mặt trời, đồi, bóng hai người) để thử hiệu ứng với nội dung giống ảnh thật
// hơn là ảnh placeholder một màu. Chỉ dùng cho trang thử trong prototypes/, không vào bản build.

const PALETTES = [
  ['#ffe3d3', '#f6a5b7', '#5b3a6b', '#2c1b3a'],
  ['#fff0c9', '#ff9a7a', '#7a3b5a', '#3a1f3b'],
  ['#e3f0ff', '#f3b0c8', '#6d4a85', '#2f2150'],
  ['#ffd9e2', '#ff8fa3', '#8a3f66', '#3b1b35'],
  ['#fff4dc', '#f7b267', '#8c4a5e', '#3a2038'],
  ['#e8e4ff', '#e7a2d6', '#5c3d7a', '#24173a'],
  ['#ffe7d6', '#ee8f8a', '#7b3f5e', '#331c33'],
  ['#fdebd0', '#f4a6a0', '#6a4172', '#2a1a40'],
]

function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeDemoPhotos(count = 8, w = 640, h = 800) {
  return Array.from({ length: count }, (_, i) => {
    const random = mulberry32(100 + i)
    const [top, mid, hill, dark] = PALETTES[i % PALETTES.length]
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d')

    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, top)
    sky.addColorStop(0.6, mid)
    sky.addColorStop(1, hill)
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)

    // mặt trời và quầng sáng
    const sx = w * (0.25 + random() * 0.5)
    const sy = h * (0.32 + random() * 0.12)
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, w * 0.55)
    glow.addColorStop(0, 'rgba(255,250,235,0.95)')
    glow.addColorStop(0.18, 'rgba(255,225,200,0.55)')
    glow.addColorStop(1, 'rgba(255,200,200,0)')
    g.fillStyle = glow
    g.fillRect(0, 0, w, h)

    // bokeh
    for (let k = 0; k < 26; k++) {
      g.beginPath()
      g.fillStyle = `rgba(255,255,255,${0.05 + random() * 0.18})`
      g.arc(random() * w, random() * h * 0.7, 8 + random() * 34, 0, Math.PI * 2)
      g.fill()
    }

    // hai lớp đồi
    for (const [layer, colour, base] of [[0, hill, 0.66], [1, dark, 0.76]]) {
      g.fillStyle = colour
      g.beginPath()
      g.moveTo(0, h)
      for (let x = 0; x <= w; x += 8) {
        const y = h * base + Math.sin(x * 0.011 + i + layer * 2) * h * 0.035 + Math.sin(x * 0.027 + layer) * h * 0.012
        g.lineTo(x, y)
      }
      g.lineTo(w, h)
      g.closePath()
      g.fill()
    }

    // bóng hai người: cô dâu (váy xoè) và chú rể
    const baseY = h * 0.76
    const cx = w * (0.4 + random() * 0.2)
    g.fillStyle = '#1b0f22'
    // chú rể
    g.beginPath()
    g.arc(cx + 38, baseY - 215, 20, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.roundRect(cx + 16, baseY - 192, 44, 120, 12)
    g.fill()
    g.fillRect(cx + 22, baseY - 74, 14, 78)
    g.fillRect(cx + 40, baseY - 74, 14, 78)
    // cô dâu
    g.beginPath()
    g.arc(cx - 34, baseY - 205, 19, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(cx - 34, baseY - 184)
    g.lineTo(cx - 50, baseY - 110)
    g.lineTo(cx - 92, baseY + 4)
    g.lineTo(cx + 22, baseY + 4)
    g.lineTo(cx - 18, baseY - 110)
    g.closePath()
    g.fill()

    // số thứ tự mờ để biết đang xem ảnh nào
    g.fillStyle = 'rgba(255,255,255,0.35)'
    g.font = `600 ${Math.round(w * 0.07)}px system-ui, sans-serif`
    g.fillText(String(i + 1).padStart(2, '0'), 26, 56)
    return canvas
  })
}
