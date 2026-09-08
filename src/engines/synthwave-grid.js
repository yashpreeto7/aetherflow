/**
 * Synthwave Grid Engine
 * Canvas 2D — retro perspective grid with sun and scanlines.
 * ~3KB, zero dependencies.
 */

export function createSynthwaveGrid(canvas, options = {}) {
  const {
    horizonColor = '#ff2d78',
    gridColor = '#b400ff',
    sunColors = ['#ffdd00', '#ff8c00', '#ff2d78'],
    speedMultiplier = 1,
  } = options

  const ctx = canvas.getContext('2d')
  let animId = null
  let offset = 0

  function resize() {
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || window.innerHeight
  }

  function frame() {
    const W = canvas.width
    const H = canvas.height
    const horizon = H * 0.5

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0d0019')
    bg.addColorStop(0.5, '#1a0033')
    bg.addColorStop(1, '#000010')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Sun
    const sunX = W / 2
    const sunY = horizon
    const sunR = Math.min(W, H) * 0.14
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR)
    sunColors.forEach((c, i) => sunGrad.addColorStop(i / (sunColors.length - 1), c))
    ctx.beginPath()
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
    ctx.fillStyle = sunGrad
    ctx.fill()

    // Sun scanlines
    ctx.save()
    ctx.beginPath()
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    for (let i = 0; i < sunR * 2; i += 6) {
      ctx.fillRect(sunX - sunR, sunY - sunR + i, sunR * 2, 3)
    }
    ctx.restore()

    // Horizon glow
    const hGlow = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 30)
    hGlow.addColorStop(0, 'rgba(255,45,120,0)')
    hGlow.addColorStop(0.5, 'rgba(255,45,120,0.6)')
    hGlow.addColorStop(1, 'rgba(255,45,120,0)')
    ctx.fillStyle = hGlow
    ctx.fillRect(0, horizon - 30, W, 60)

    // ── Perspective Grid ──────────────────────────────────────────
    const vp = { x: W / 2, y: horizon }         // vanishing point
    const gridCols = 14
    const gridRows = 10
    const gridBottom = H + 40

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, horizon, W, H - horizon)
    ctx.clip()

    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1

    // Vertical lines
    for (let i = 0; i <= gridCols; i++) {
      const t = i / gridCols
      const bx = W * t
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.moveTo(vp.x + (bx - vp.x) * 0.01, horizon)
      ctx.lineTo(bx, gridBottom)
      ctx.stroke()
    }

    // Horizontal lines (scrolling)
    for (let i = 0; i < gridRows; i++) {
      const rawT = (i / gridRows + (offset % (1 / gridRows)) * gridRows) % 1
      const t = Math.pow(rawT, 2)
      const y = horizon + (gridBottom - horizon) * t
      const alpha = rawT * 0.7
      ctx.globalAlpha = alpha
      const lx = vp.x + (0 - vp.x) * (1 - rawT * 0.95)
      const rx = vp.x + (W - vp.x) * (1 - rawT * 0.95)
      ctx.beginPath()
      ctx.moveTo(lx, y)
      ctx.lineTo(rx, y)
      ctx.stroke()
    }

    ctx.restore()
    ctx.globalAlpha = 1

    // Scanlines overlay
    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.fillRect(0, y, W, 2)
    }

    offset += 0.003 * speedMultiplier
    animId = requestAnimationFrame(frame)
  }

  function start() {
    resize()
    window.addEventListener('resize', resize)
    animId = requestAnimationFrame(frame)
  }

  function stop() {
    if (animId) cancelAnimationFrame(animId)
    window.removeEventListener('resize', resize)
  }

  function updateOptions(newOpts) {
    Object.assign(options, newOpts)
  }

  return { start, stop, updateOptions }
}
