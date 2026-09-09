/**
 * Cyber Particles Engine
 * Lightweight Canvas 2D — connected particle network with mouse repulsion.
 * ~3KB, zero dependencies.
 */

export function createCyberParticles(canvas, options = {}) {
  let {
    color = '#00d4ff',
    particleCount = 80,
    connectionDistance = 120,
    speedMultiplier = 1,
    mouseRepel = true,
    fps = 60,
  } = options

  const ctx = canvas.getContext('2d')
  let particles = []
  let animId = null
  let lastFrame = 0
  let mouse = { x: -9999, y: -9999 }

  class Particle {
    constructor(w, h) {
      this.reset(w, h)
    }
    reset(w, h) {
      this.x = Math.random() * w
      this.y = Math.random() * h
      this.vx = (Math.random() - 0.5) * 0.8
      this.vy = (Math.random() - 0.5) * 0.8
      this.size = Math.random() * 2 + 1
      this.alpha = Math.random() * 0.5 + 0.3
    }
  }

  function resize() {
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || window.innerHeight
    particles = Array.from({ length: particleCount }, () => new Particle(canvas.width, canvas.height))
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect()
    mouse.x = e.clientX - rect.left
    mouse.y = e.clientY - rect.top
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r},${g},${b}`
  }

  let rgb = hexToRgb(color)

  function frame(ts) {
    animId = requestAnimationFrame(frame)
    if (fps < 120) {
      const minInterval = 1000 / fps
      if (ts - lastFrame < minInterval - 1) {
        return
      }
    }
    lastFrame = ts

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    // Update + draw particles
    for (const p of particles) {
      // Mouse repulsion
      if (mouseRepel) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 80) {
          p.vx += (dx / dist) * 0.5
          p.vy += (dy / dist) * 0.5
        }
      }

      // Speed damping
      p.vx *= 0.99
      p.vy *= 0.99

      p.x += p.vx * speedMultiplier
      p.y += p.vy * speedMultiplier

      // Wrap edges
      if (p.x < 0) p.x = w
      if (p.x > w) p.x = 0
      if (p.y < 0) p.y = h
      if (p.y > h) p.y = 0

      // Draw dot
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rgb},${p.alpha})`
      ctx.fill()
    }

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < connectionDistance) {
          const alpha = (1 - dist / connectionDistance) * 0.4
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.strokeStyle = `rgba(${rgb},${alpha})`
          ctx.lineWidth = 0.8
          ctx.stroke()
        }
      }
    }
  }

  function start() {
    resize()
    window.addEventListener('resize', resize)
    if (mouseRepel) canvas.addEventListener('mousemove', onMouseMove)
    animId = requestAnimationFrame(frame)
  }

  function stop() {
    if (animId) cancelAnimationFrame(animId)
    animId = null
    window.removeEventListener('resize', resize)
    canvas.removeEventListener('mousemove', onMouseMove)
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
    if (newOpts.color !== undefined) {
      color = newOpts.color
      rgb = hexToRgb(color)
    }
    if (newOpts.speedMultiplier !== undefined) speedMultiplier = newOpts.speedMultiplier
    if (newOpts.fps !== undefined) fps = newOpts.fps
    if (newOpts.connectionDistance !== undefined) connectionDistance = newOpts.connectionDistance
    if (newOpts.particleCount !== undefined && newOpts.particleCount !== particleCount) {
      particleCount = newOpts.particleCount
      resize()
    }
    if (newOpts.paused !== undefined) {
      if (newOpts.paused) pause()
      else resume()
    }
  }

  return { start, stop, updateOptions, pause, resume }
}
