/**
 * Deep Space Starfield Engine
 * Canvas 2D — 3-layer parallax stars with nebula glow and shooting stars.
 * ~3KB, zero dependencies.
 */

export function createDeepSpace(canvas, options = {}) {
  const {
    starCount = 300,
    nebulaColors = ['#6600cc', '#003399', '#cc0066'],
    speedMultiplier = 1,
    shootingStars = true,
  } = options

  const ctx = canvas.getContext('2d')
  let animId = null
  let stars = []
  let shooters = []

  class Star {
    constructor(w, h) { this.reset(w, h, true) }
    reset(w, h, initial = false) {
      this.x = Math.random() * w
      this.y = initial ? Math.random() * h : 0
      this.z = Math.random()                  // depth (0=far, 1=near)
      this.size = this.z * 2.5 + 0.3
      this.speed = (this.z * 0.3 + 0.05) * speedMultiplier
      this.alpha = this.z * 0.7 + 0.2
      this.twinkle = Math.random() * Math.PI * 2
    }
  }

  class ShootingStar {
    constructor(w, h) { this.reset(w, h) }
    reset(w, h) {
      this.x = Math.random() * w
      this.y = Math.random() * h * 0.4
      this.len = Math.random() * 120 + 60
      this.speed = Math.random() * 10 + 8
      this.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5
      this.alpha = 1
      this.active = true
    }
  }

  function resize() {
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || window.innerHeight
    stars = Array.from({ length: starCount }, () => new Star(canvas.width, canvas.height))
  }

  function spawnShooter() {
    if (shooters.length < 3 && Math.random() < 0.003) {
      shooters.push(new ShootingStar(canvas.width, canvas.height))
    }
  }

  function frame() {
    const W = canvas.width
    const H = canvas.height

    // Background
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.8)
    bg.addColorStop(0, '#070012')
    bg.addColorStop(0.4, '#040009')
    bg.addColorStop(1, '#000005')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Nebula clouds
    nebulaColors.forEach((c, i) => {
      const nx = W * (0.2 + i * 0.3)
      const ny = H * (0.2 + (i % 2) * 0.5)
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, W * 0.25)
      ng.addColorStop(0, c + '18')
      ng.addColorStop(1, 'transparent')
      ctx.fillStyle = ng
      ctx.fillRect(0, 0, W, H)
    })

    // Stars
    for (const s of stars) {
      s.twinkle += 0.03
      const alpha = s.alpha * (0.85 + Math.sin(s.twinkle) * 0.15)
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${alpha})`
      ctx.fill()

      s.y += s.speed
      if (s.y > H) s.reset(W, H)
    }

    // Shooting stars
    spawnShooter()
    shooters = shooters.filter(s => s.active)
    for (const s of shooters) {
      const tx = s.x + Math.cos(s.angle) * s.len
      const ty = s.y + Math.sin(s.angle) * s.len
      const grad = ctx.createLinearGradient(s.x, s.y, tx, ty)
      grad.addColorStop(0, `rgba(255,255,255,${s.alpha})`)
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(tx, ty)
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.5
      ctx.stroke()

      s.x += Math.cos(s.angle) * s.speed
      s.y += Math.sin(s.angle) * s.speed
      s.alpha -= 0.015
      if (s.alpha <= 0 || s.x > W || s.y > H) s.active = false
    }

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
