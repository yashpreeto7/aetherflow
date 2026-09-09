/**
 * FPS Benchmark HUD Engine
 * Canvas 2D — Cyberpunk telemetry wallpaper with live rolling FPS counter,
 * target cap indicator, frame-time graph (ms), and rotating performance gauge.
 * Lightweight, zero dependencies, strictly Canvas 2D.
 */

export function createFpsMeter(canvas, options = {}) {
  let {
    color = '#00ffcc',
    accentColor = '#ff0055',
    gridColor = 'rgba(0, 255, 204, 0.15)',
    speedMultiplier = 1,
    fps = 60,
  } = options

  const ctx = canvas.getContext('2d')
  let animId = null
  let lastFrame = 0
  let frameTimes = []
  let currentFps = 60
  let avgFps = 60
  let lastFpsUpdate = 0
  let angle = 0
  let particles = []

  function resize() {
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || window.innerHeight

    // Initialize decorative floating cyber-nodes
    particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      size: Math.random() * 2 + 1,
    }))
  }

  function frame(ts) {
    animId = requestAnimationFrame(frame)

    // FPS Pacing limiter
    if (fps < 120) {
      const minInterval = 1000 / fps
      if (ts - lastFrame < minInterval - 1) {
        return
      }
    }

    const delta = ts - (lastFrame || ts)
    lastFrame = ts

    // Rolling frame history for oscilloscope
    if (delta > 0) {
      frameTimes.push(delta)
      if (frameTimes.length > 80) frameTimes.shift()
    }

    // Rolling FPS update (every 100ms to keep numbers readable)
    if (ts - lastFpsUpdate > 100) {
      if (frameTimes.length > 0) {
        const avgDelta = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
        currentFps = Math.round(1000 / avgDelta)
        avgFps = Math.min(fps, currentFps)
      }
      lastFpsUpdate = ts
    }

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2

    // 1. Dark futuristic background
    const bg = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(W, H) * 0.7)
    bg.addColorStop(0, '#060d16')
    bg.addColorStop(0.6, '#03070b')
    bg.addColorStop(1, '#010305')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // 2. Animated Cyber Grid
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1
    const gridSize = 45
    const offset = (ts * 0.02 * speedMultiplier) % gridSize

    ctx.beginPath()
    for (let x = offset; x < W; x += gridSize) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
    }
    for (let y = offset; y < H; y += gridSize) {
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
    }
    ctx.stroke()

    // 3. Floating telemetry particles
    ctx.fillStyle = color
    for (const p of particles) {
      p.x += p.vx * speedMultiplier
      p.y += p.vy * speedMultiplier
      if (p.x < 0) p.x = W
      if (p.x > W) p.x = 0
      if (p.y < 0) p.y = H
      if (p.y > H) p.y = 0

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // 4. Central Circular Gauge & HUD
    const radius = Math.min(W, H) * 0.22
    angle += 0.015 * speedMultiplier

    // Outer spinning dashed tech ring
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.setLineDash([12, 16])
    ctx.beginPath()
    ctx.arc(0, 0, radius + 25, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // Counter-spinning secondary ring
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-angle * 0.6)
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 18, 12, 10])
    ctx.beginPath()
    ctx.arc(0, 0, radius + 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // Gauge background arc
    ctx.save()
    ctx.translate(cx, cy)
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.beginPath()
    ctx.arc(0, 0, radius, Math.PI * 0.75, Math.PI * 2.25)
    ctx.stroke()

    // Active FPS arc indicator (proportional to target or 120)
    const maxScale = Math.max(fps, 60)
    const pct = Math.min(Math.max(avgFps / maxScale, 0), 1)
    const endArc = Math.PI * 0.75 + pct * (Math.PI * 1.5)

    const arcGrad = ctx.createLinearGradient(-radius, 0, radius, 0)
    arcGrad.addColorStop(0, color)
    arcGrad.addColorStop(1, accentColor)
    ctx.strokeStyle = arcGrad
    ctx.shadowColor = color
    ctx.shadowBlur = 15
    ctx.beginPath()
    ctx.arc(0, 0, radius, Math.PI * 0.75, endArc)
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.restore()

    // 5. Main Center Text Displays
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Sub-title / System Status
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.font = '11px "JetBrains Mono", monospace'
    ctx.fillText('AETHERFLOW TELEMETRY', cx, cy - radius * 0.52)

    // Huge Digital FPS Readout
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(radius * 0.65)}px "JetBrains Mono", monospace`
    ctx.shadowColor = color
    ctx.shadowBlur = 20
    ctx.fillText(`${avgFps}`, cx, cy - radius * 0.05)
    ctx.shadowBlur = 0

    // FPS Unit Label
    ctx.fillStyle = color
    ctx.font = 'bold 15px "JetBrains Mono", monospace'
    ctx.fillText('FRAMES / SEC', cx, cy + radius * 0.35)

    // Target Limit vs Frame Time
    const currentMs = delta ? delta.toFixed(1) : (1000 / (fps || 60)).toFixed(1)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.font = '12px "JetBrains Mono", monospace'
    ctx.fillText(`LIMIT: ${fps} FPS  •  FRAME: ${currentMs}ms`, cx, cy + radius * 0.55)

    // 6. Bottom Oscilloscope Graph
    const graphW = Math.min(W * 0.55, 420)
    const graphH = 50
    const graphX = cx - graphW / 2
    const graphY = cy + radius + 45

    // Graph panel bg
    ctx.fillStyle = 'rgba(0, 20, 30, 0.65)'
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.rect(graphX, graphY, graphW, graphH)
    ctx.fill()
    ctx.stroke()

    // Graph title & baseline
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.font = '9px "JetBrains Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('FRAME TIME OSCILLOSCOPE', graphX + 8, graphY + 12)

    // Frame graph line
    if (frameTimes.length > 1) {
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      const step = graphW / (frameTimes.length - 1)
      frameTimes.forEach((ft, i) => {
        // Map 0 - 50ms to graph height (higher ms = lower graph line)
        const norm = Math.min(Math.max(ft / 45, 0), 1)
        const gx = graphX + i * step
        const gy = graphY + graphH - 4 - norm * (graphH - 18)
        if (i === 0) ctx.moveTo(gx, gy)
        else ctx.lineTo(gx, gy)
      })
      ctx.stroke()
    }
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
    if (newOpts.color !== undefined) color = newOpts.color
    if (newOpts.accentColor !== undefined) accentColor = newOpts.accentColor
    if (newOpts.gridColor !== undefined) gridColor = newOpts.gridColor
    if (newOpts.speedMultiplier !== undefined) speedMultiplier = newOpts.speedMultiplier
    if (newOpts.fps !== undefined) fps = newOpts.fps
    if (newOpts.paused !== undefined) {
      if (newOpts.paused) pause()
      else resume()
    }
  }

  return { start, stop, updateOptions, pause, resume }
}
