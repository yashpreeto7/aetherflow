/**
 * Tokyo City Rain Engine
 * Canvas 2D — anime-style rain over neon-lit city silhouette.
 * ~3.5KB, zero dependencies.
 */

export function createTokyoRain(canvas, options = {}) {
  const {
    rainColor = 'rgba(150,210,255,0.55)',
    neonColors = ['#ff2d78', '#00d4ff', '#b400ff', '#ffcc00'],
    speedMultiplier = 1,
    rainCount = 200,
  } = options

  const ctx = canvas.getContext('2d')
  let animId = null
  let drops = []
  let buildingsCache = null

  class RainDrop {
    constructor(w, h) { this.reset(w, h) }
    reset(w, h) {
      this.x = Math.random() * w
      this.y = Math.random() * h - h
      this.len = Math.random() * 20 + 10
      this.speed = (Math.random() * 8 + 6) * speedMultiplier
      this.alpha = Math.random() * 0.5 + 0.2
    }
  }

  function buildCity(W, H) {
    // Procedural city silhouette — random but seeded by canvas size
    const buildings = []
    let x = 0
    while (x < W) {
      const w = Math.floor(Math.random() * 60 + 20)
      const h = Math.floor(Math.random() * H * 0.4 + H * 0.15)
      buildings.push({ x, y: H - h, w, h })
      x += w + Math.floor(Math.random() * 4)
    }
    return buildings
  }

  function drawCity(buildings, W, H) {
    // Background gradient (city sky)
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#0a001a')
    sky.addColorStop(0.4, '#100020')
    sky.addColorStop(0.8, '#1a0035')
    sky.addColorStop(1, '#0d0020')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)

    // Neon ground glow
    const glow = ctx.createLinearGradient(0, H * 0.8, 0, H)
    glow.addColorStop(0, 'rgba(180,0,255,0.0)')
    glow.addColorStop(0.5, 'rgba(180,0,255,0.12)')
    glow.addColorStop(1, 'rgba(0,212,255,0.18)')
    ctx.fillStyle = glow
    ctx.fillRect(0, H * 0.8, W, H * 0.2)

    // Buildings
    for (const b of buildings) {
      // Building body
      ctx.fillStyle = '#050010'
      ctx.fillRect(b.x, b.y, b.w, b.h)

      // Random lit windows
      const cols = Math.floor(b.w / 10)
      const rows = Math.floor(b.h / 14)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.3) {
            const wc = neonColors[Math.floor(Math.random() * neonColors.length)]
            ctx.fillStyle = wc + '88'
            ctx.fillRect(b.x + c * 10 + 2, b.y + r * 14 + 3, 6, 8)
          }
        }
      }

      // Neon edge glow on some buildings
      if (Math.random() < 0.3) {
        const nc = neonColors[Math.floor(Math.random() * neonColors.length)]
        ctx.shadowColor = nc
        ctx.shadowBlur = 12
        ctx.strokeStyle = nc + 'aa'
        ctx.lineWidth = 1
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h)
        ctx.shadowBlur = 0
      }
    }
  }

  function resize() {
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || window.innerHeight
    buildingsCache = buildCity(canvas.width, canvas.height)
    drops = Array.from({ length: rainCount }, () => new RainDrop(canvas.width, canvas.height))
  }

  function frame() {
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)
    drawCity(buildingsCache, W, H)

    // Rain
    ctx.lineCap = 'round'
    for (const d of drops) {
      ctx.beginPath()
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(d.x - 1, d.y + d.len)
      ctx.strokeStyle = rainColor.replace('0.55', String(d.alpha))
      ctx.lineWidth = 1
      ctx.stroke()

      d.y += d.speed
      if (d.y > H) d.reset(W, H)
    }

    // Fog overlay
    ctx.fillStyle = 'rgba(10,0,30,0.12)'
    ctx.fillRect(0, 0, W, H)

    animId = requestAnimationFrame(frame)
  }

  function start() {
    resize()
    window.addEventListener('resize', resize)
    animId = requestAnimationFrame(frame)
  }

  function stop() {
    if (animId) cancelAnimationFrame(animId)
    animId = null
    window.removeEventListener('resize', resize)
  }

  function pause() {
    if (animId) {
      cancelAnimationFrame(animId)
      animId = null
    }
  }

  function resume() {
    if (!animId) {
      animId = requestAnimationFrame(frame)
    }
  }

  function updateOptions(newOpts) {
    Object.assign(options, newOpts)
    if (newOpts.paused !== undefined) {
      if (newOpts.paused) pause()
      else resume()
    }
  }

  return { start, stop, updateOptions, pause, resume }
}
