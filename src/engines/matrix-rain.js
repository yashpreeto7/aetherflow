/**
 * Matrix Rain Engine
 * Lightweight Canvas 2D — green digital rain columns.
 * ~2KB, zero dependencies.
 */

const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF'

export function createMatrixRain(canvas, options = {}) {
  const {
    color = '#00ff41',
    bgAlpha = 0.05,
    fontSize = 14,
    speedMultiplier = 1,
  } = options

  const ctx = canvas.getContext('2d')
  let animId = null
  let drops = []
  let lastFrame = 0

  function resize() {
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || window.innerHeight
    const cols = Math.floor(canvas.width / fontSize)
    drops = Array.from({ length: cols }, () => Math.random() * -canvas.height / fontSize)
  }

  function frame(ts) {
    const elapsed = ts - lastFrame
    // Cap at ~60fps but allow speed multiplier
    if (elapsed < 1000 / (60 * speedMultiplier)) {
      animId = requestAnimationFrame(frame)
      return
    }
    lastFrame = ts

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = color
    ctx.font = `${fontSize}px 'JetBrains Mono', monospace`

    for (let i = 0; i < drops.length; i++) {
      const char = CHARS[Math.floor(Math.random() * CHARS.length)]
      const x = i * fontSize
      const y = drops[i] * fontSize

      // Bright head
      ctx.fillStyle = '#ffffff'
      ctx.fillText(char, x, y)

      ctx.fillStyle = color
      if (y > 20) {
        ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, y - fontSize)
      }

      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = 0
      }
      drops[i] += speedMultiplier * 0.5
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
    window.removeEventListener('resize', resize)
  }

  function updateOptions(newOpts) {
    Object.assign(options, newOpts)
  }

  return { start, stop, updateOptions }
}
