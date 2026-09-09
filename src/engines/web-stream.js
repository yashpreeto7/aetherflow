/**
 * Web Stream & YouTube Wallpaper Engine
 * Renders live streams, ambient YouTube loops, or interactive web pages as wallpapers.
 * - Thumbnail / Canvas 2D fallback for performant grid previews
 * - Borderless zero-latency iframe for desktop wallpaper playback
 */

export function parseYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const clean = url.trim()
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ]
  for (const pattern of patterns) {
    const match = clean.match(pattern)
    if (match && match[1]) return match[1]
  }
  return null
}

export function getYouTubeThumbnail(videoId) {
  if (!videoId) return null
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

export function createWebStream(canvas, options = {}) {
  const ctx = canvas.getContext('2d')
  let animId = null
  let iframeEl = null
  let thumbImg = null
  let thumbLoaded = false
  let currentUrl = options.streamUrl || ''
  let currentMuted = options.muted ?? true
  let isRunning = false

  function resize() {
    if (!canvas) return
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || window.innerHeight
    renderThumbnail()
  }

  function renderThumbnail() {
    if (!ctx || !canvas.width || !canvas.height) return
    ctx.fillStyle = '#05070a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (thumbLoaded && thumbImg && thumbImg.complete) {
      const cw = canvas.width
      const ch = canvas.height
      const iw = thumbImg.naturalWidth || 480
      const ih = thumbImg.naturalHeight || 360
      const scale = Math.max(cw / iw, ch / ih)
      const sw = iw * scale
      const sh = ih * scale
      const sx = (cw - sw) / 2
      const sy = (ch - sh) / 2
      ctx.drawImage(thumbImg, sx, sy, sw, sh)
    } else {
      // Sleek ambient gradient placeholder
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      grad.addColorStop(0, '#090d16')
      grad.addColorStop(0.5, '#121b2d')
      grad.addColorStop(1, '#06080e')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }

  function loadThumbnail(ytId) {
    if (!ytId) {
      thumbLoaded = false
      renderThumbnail()
      return
    }
    thumbImg = new Image()
    thumbImg.crossOrigin = 'anonymous'
    thumbImg.onload = () => {
      thumbLoaded = true
      renderThumbnail()
    }
    thumbImg.onerror = () => {
      thumbLoaded = false
      renderThumbnail()
    }
    thumbImg.src = getYouTubeThumbnail(ytId)
  }

  function buildEmbedUrl(url, muted) {
    const ytId = parseYouTubeId(url)
    if (ytId) {
      const muteParam = muted ? '1' : '0'
      return `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=${muteParam}&controls=0&loop=1&playlist=${ytId}&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&playsinline=1`
    }
    return url
  }

  function mountIframe() {
    if (options.preview) return // Preview cards use canvas thumbnail to save resources

    if (!iframeEl && canvas.parentElement) {
      iframeEl = document.createElement('iframe')
      iframeEl.setAttribute('allow', 'autoplay; encrypted-media; fullscreen')
      iframeEl.setAttribute('referrerpolicy', 'no-referrer')
      iframeEl.style.position = 'absolute'
      iframeEl.style.top = '0'
      iframeEl.style.left = '0'
      iframeEl.style.width = '100%'
      iframeEl.style.height = '100%'
      iframeEl.style.border = 'none'
      iframeEl.style.pointerEvents = 'none'
      iframeEl.style.zIndex = '1'
      iframeEl.style.opacity = String(options.opacity ?? 1)
      iframeEl.style.filter = `brightness(${options.brightness ?? 1})`
      iframeEl.src = buildEmbedUrl(currentUrl, currentMuted)
      canvas.parentElement.appendChild(iframeEl)
    }
  }

  function unmountIframe() {
    if (iframeEl) {
      try {
        iframeEl.src = 'about:blank'
        iframeEl.remove()
      } catch {}
      iframeEl = null
    }
  }

  function frame() {
    if (!isRunning) return
    animId = requestAnimationFrame(frame)
  }

  function start() {
    isRunning = true
    resize()
    window.addEventListener('resize', resize)

    const ytId = parseYouTubeId(currentUrl)
    if (ytId) {
      loadThumbnail(ytId)
    } else {
      renderThumbnail()
    }

    if (!options.preview) {
      mountIframe()
    }

    animId = requestAnimationFrame(frame)
  }

  function stop() {
    isRunning = false
    if (animId) {
      cancelAnimationFrame(animId)
      animId = null
    }
    window.removeEventListener('resize', resize)
    unmountIframe()
  }

  function updateOptions(newOpts = {}) {
    Object.assign(options, newOpts)
    if (newOpts.streamUrl !== undefined && newOpts.streamUrl !== currentUrl) {
      currentUrl = newOpts.streamUrl
      const ytId = parseYouTubeId(currentUrl)
      if (ytId) loadThumbnail(ytId)
      if (iframeEl) iframeEl.src = buildEmbedUrl(currentUrl, currentMuted)
    }
    if (newOpts.muted !== undefined && newOpts.muted !== currentMuted) {
      currentMuted = newOpts.muted
      if (iframeEl) iframeEl.src = buildEmbedUrl(currentUrl, currentMuted)
    }
    if (iframeEl) {
      if (newOpts.opacity !== undefined) iframeEl.style.opacity = String(newOpts.opacity)
      if (newOpts.brightness !== undefined) iframeEl.style.filter = `brightness(${newOpts.brightness})`
    }
  }

  return { start, stop, updateOptions }
}

export default createWebStream
