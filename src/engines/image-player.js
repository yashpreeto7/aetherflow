import { convertFileSrc } from '@tauri-apps/api/core'

/**
 * Image Player Engine
 * Canvas 2D — renders high-resolution local picture wallpapers (PNG, JPG, JPEG, WebP, BMP)
 * with cover/contain/stretch scaling and zero unnecessary CPU consumption.
 */
export function createImagePlayer(canvas, options = {}) {
  const ctx = canvas.getContext('2d')
  let animId = null
  let img = null
  let isLoaded = false
  let currentPath = ''

  function resize() {
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || window.innerHeight
    render()
  }

  function render() {
    if (!ctx || !canvas.width || !canvas.height) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!isLoaded || !img || !img.complete || img.naturalWidth === 0) return

    const cw = canvas.width
    const ch = canvas.height
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const fit = options.fit || 'cover'

    if (fit === 'contain') {
      const scale = Math.min(cw / iw, ch / ih)
      const sw = iw * scale
      const sh = ih * scale
      const sx = (cw - sw) / 2
      const sy = (ch - sh) / 2
      ctx.drawImage(img, sx, sy, sw, sh)
    } else if (fit === 'stretch') {
      ctx.drawImage(img, 0, 0, cw, ch)
    } else {
      // 'cover' — default to fill display without distortion
      const scale = Math.max(cw / iw, ch / ih)
      const sw = iw * scale
      const sh = ih * scale
      const sx = (cw - sw) / 2
      const sy = (ch - sh) / 2
      ctx.drawImage(img, sx, sy, sw, sh)
    }
  }

  function loadImage(path) {
    if (!path) {
      isLoaded = false
      render()
      return
    }
    currentPath = path
    isLoaded = false

    const src = (path.startsWith('http') || path.startsWith('data:'))
      ? path
      : convertFileSrc(path)

    img = new Image()
    img.onload = () => {
      isLoaded = true
      render()
    }
    img.onerror = (err) => {
      console.error('[AetherFlow] Failed to load image wallpaper:', path, err)
    }
    img.src = src
  }

  function frame() {
    // Keep animation loop alive per engine specification
    animId = requestAnimationFrame(frame)
  }

  function start() {
    resize()
    window.addEventListener('resize', resize)
    if (options.imagePath) {
      loadImage(options.imagePath)
    }
    animId = requestAnimationFrame(frame)
  }

  function stop() {
    if (animId) cancelAnimationFrame(animId)
    window.removeEventListener('resize', resize)
    isLoaded = false
    if (img) {
      img.onload = null
      img.onerror = null
      img.src = ''
      img = null
    }
    if (ctx && canvas.width && canvas.height) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
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
    if (newOpts.imagePath && newOpts.imagePath !== currentPath) {
      loadImage(newOpts.imagePath)
    } else {
      render()
    }
  }

  return { start, stop, updateOptions, pause, resume }
}

export default createImagePlayer
