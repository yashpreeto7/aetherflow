/**
 * Aurora Borealis Engine
 * Canvas 2D — smooth undulating aurora curtains with star field.
 * ~3KB, zero dependencies.
 */

export function createAurora(canvas, options = {}) {
  let {
    colors = ['#00ff88', '#0088ff', '#8800ff', '#ff0088'],
    speedMultiplier = 1,
    starCount = 150,
    intensity = 0.7,
    fps = 60,
  } = options

  const ctx = canvas.getContext('2d')
  let animId = null
  let time = 0
  let stars = []
  let lastFrame = 0

  function resize() {
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || window.innerHeight
    stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random(),
      tw: Math.random() * Math.PI * 2,
    }))
  }

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    }
  }

  function drawAuroraLayer(W, H, color, phaseOffset, yBase, amplitude, alpha) {
    const { r, g, b } = hexToRgb(color)
    const points = []
    const steps = 80

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = t * W
      const y = yBase
        + Math.sin(t * 3 + time * 0.5 + phaseOffset) * amplitude * 0.4
        + Math.sin(t * 7 + time * 0.3 + phaseOffset * 2) * amplitude * 0.15
        + Math.cos(t * 5 + time * 0.7 + phaseOffset * 0.5) * amplitude * 0.25
      points.push({ x, y })
    }

    // Draw aurora curtain as filled shape
    ctx.beginPath()
    ctx.moveTo(0, H)
    for (const p of points) ctx.lineTo(p.x, p.y)
    ctx.lineTo(W, H)
    ctx.closePath()

    const grad = ctx.createLinearGradient(0, yBase - amplitude, 0, H)
    grad.addColorStop(0, `rgba(${r},${g},${b},0)`)
    grad.addColorStop(0.3, `rgba(${r},${g},${b},${alpha * intensity})`)
    grad.addColorStop(0.7, `rgba(${r},${g},${b},${alpha * intensity * 0.5})`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = grad
    ctx.fill()
  }

  function frame(ts) {
    animId = requestAnimationFrame(frame)
    if (fps < 120) {
      const minInterval = 1000 / fps
      if (ts - lastFrame < minInterval - 1) {
        return
      }
    }
    lastFrame = ts

    const W = canvas.width
    const H = canvas.height

    // Night sky bg
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#000810')
    bg.addColorStop(0.6, '#000d1a')
    bg.addColorStop(1, '#001022')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Stars
    for (const s of stars) {
      s.tw += 0.02
      const alpha = s.a * (0.7 + Math.sin(s.tw) * 0.3)
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${alpha})`
      ctx.fill()
    }

    // Aurora layers
    const baseY = H * 0.35
    colors.forEach((color, i) => {
      const phaseOff = (i / colors.length) * Math.PI * 2
      const yOff = (i - colors.length / 2) * H * 0.06
      const amp = H * (0.08 + i * 0.02)
      const alpha = 0.25 + i * 0.05
      drawAuroraLayer(W, H, color, phaseOff, baseY + yOff, amp, alpha)
    })

    // Ground reflection
    const ref = ctx.createLinearGradient(0, H * 0.85, 0, H)
    ref.addColorStop(0, 'rgba(0,255,136,0.03)')
    ref.addColorStop(1, 'rgba(0,136,255,0.06)')
    ctx.fillStyle = ref
    ctx.fillRect(0, H * 0.85, W, H * 0.15)

    time += 0.008 * speedMultiplier
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
      lastFrame = performance.now()
      animId = requestAnimationFrame(frame)
    }
  }

  function updateOptions(newOpts) {
    Object.assign(options, newOpts)
    if (newOpts.speedMultiplier !== undefined) speedMultiplier = newOpts.speedMultiplier
    if (newOpts.fps !== undefined) fps = newOpts.fps
    if (newOpts.intensity !== undefined) intensity = newOpts.intensity
    if (newOpts.colors !== undefined) colors = newOpts.colors
    if (newOpts.paused !== undefined) {
      if (newOpts.paused) pause()
      else resume()
    }
  }

  return { start, stop, updateOptions, pause, resume }
}
