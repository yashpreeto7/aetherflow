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

  let isPausedByUser = false
  let loopPingTimer = null

  function applyIframeStyles(isYt) {
    if (!iframeEl) return
    iframeEl.style.position = 'absolute'
    iframeEl.style.border = 'none'
    iframeEl.style.pointerEvents = 'none'
    iframeEl.style.zIndex = '1'
    iframeEl.style.opacity = String(options.opacity ?? 1)
    iframeEl.style.filter = `brightness(${options.brightness ?? 1})`

    if (isYt) {
      // Overscan YouTube player slightly so top title bar, share buttons,
      // and bottom media controls/progress bar are pushed completely off-screen.
      // This produces a pure, borderless cinematic wallpaper.
      iframeEl.style.top = '-60px'
      iframeEl.style.left = '-60px'
      iframeEl.style.width = 'calc(100% + 120px)'
      iframeEl.style.height = 'calc(100% + 120px)'
    } else {
      iframeEl.style.top = '0'
      iframeEl.style.left = '0'
      iframeEl.style.width = '100%'
      iframeEl.style.height = '100%'
    }
  }

  function onWindowMessage(event) {
    if (!iframeEl || !event.data) return
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      if (!data) return

      // Handle onReady: confirm listening
      if (data.event === 'onReady') {
        iframeEl.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*')
      }

      // Check player state: 0 = ENDED
      const state = data.info?.playerState !== undefined 
        ? data.info.playerState 
        : (data.event === 'onStateChange' ? data.info : null)

      if (state === 0 && !isPausedByUser) {
        // Instant loop: rewind to 0 and play to prevent reload screen
        iframeEl.contentWindow?.postMessage(JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [0, true]
        }), '*')
        iframeEl.contentWindow?.postMessage(JSON.stringify({
          event: 'command',
          func: 'playVideo',
          args: []
        }), '*')
      }

      // Proactive loop: rewind 0.35s before hitting the very end
      if (data.event === 'infoDelivery' && data.info && !isPausedByUser) {
        const cur = data.info.currentTime
        const dur = data.info.duration
        if (typeof cur === 'number' && typeof dur === 'number' && dur > 2 && cur >= dur - 0.35) {
          iframeEl.contentWindow?.postMessage(JSON.stringify({
            event: 'command',
            func: 'seekTo',
            args: [0, true]
          }), '*')
          iframeEl.contentWindow?.postMessage(JSON.stringify({
            event: 'command',
            func: 'playVideo',
            args: []
          }), '*')
        }
      }
    } catch {}
  }

  function buildEmbedUrl(url, muted) {
    const ytId = parseYouTubeId(url)
    if (ytId) {
      const muteParam = muted ? '1' : '0'
      // Use standard youtube.com/embed with strict-origin referrerpolicy to satisfy YouTube security & anti-bot checks
      return `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=${muteParam}&controls=0&loop=1&playlist=${ytId}&enablejsapi=1&rel=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1`
    }
    return url
  }

  function mountIframe() {
    if (options.preview) return // Preview cards use canvas thumbnail to save resources

    if (!iframeEl && canvas.parentElement) {
      const ytId = parseYouTubeId(currentUrl)
      iframeEl = document.createElement('iframe')
      iframeEl.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen')
      iframeEl.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
      applyIframeStyles(Boolean(ytId))
      iframeEl.src = buildEmbedUrl(currentUrl, currentMuted)
      canvas.parentElement.appendChild(iframeEl)

      window.addEventListener('message', onWindowMessage)

      // Periodically ping listening so YouTube registers our listener
      if (ytId) {
        if (loopPingTimer) clearInterval(loopPingTimer)
        loopPingTimer = setInterval(() => {
          if (iframeEl?.contentWindow) {
            iframeEl.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*')
          }
        }, 1500)
      }
    }
  }

  function unmountIframe() {
    window.removeEventListener('message', onWindowMessage)
    if (loopPingTimer) {
      clearInterval(loopPingTimer)
      loopPingTimer = null
    }
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

  function pause() {
    isPausedByUser = true
    if (iframeEl) {
      const ytId = parseYouTubeId(currentUrl)
      if (ytId) {
        try {
          iframeEl.contentWindow?.postMessage(JSON.stringify({
            event: 'command',
            func: 'pauseVideo',
            args: []
          }), '*')
        } catch {}
      }
    }
  }

  function resume() {
    isPausedByUser = false
    if (iframeEl) {
      const ytId = parseYouTubeId(currentUrl)
      if (ytId) {
        try {
          iframeEl.contentWindow?.postMessage(JSON.stringify({
            event: 'command',
            func: 'playVideo',
            args: []
          }), '*')
        } catch {}
      }
    }
  }

  function updateOptions(newOpts = {}) {
    Object.assign(options, newOpts)
    if (newOpts.streamUrl !== undefined && newOpts.streamUrl !== currentUrl) {
      currentUrl = newOpts.streamUrl
      const ytId = parseYouTubeId(currentUrl)
      if (ytId) loadThumbnail(ytId)
      if (iframeEl) {
        applyIframeStyles(Boolean(ytId))
        iframeEl.src = buildEmbedUrl(currentUrl, currentMuted)
      }
    }
    if (newOpts.muted !== undefined && newOpts.muted !== currentMuted) {
      currentMuted = newOpts.muted
      if (iframeEl) {
        const ytId = parseYouTubeId(currentUrl)
        if (ytId) {
          try {
            iframeEl.contentWindow?.postMessage(JSON.stringify({
              event: 'command',
              func: currentMuted ? 'mute' : 'unMute',
              args: []
            }), '*')
          } catch {}
        } else {
          iframeEl.src = buildEmbedUrl(currentUrl, currentMuted)
        }
      }
    }
    if (newOpts.volume !== undefined && iframeEl) {
      const ytId = parseYouTubeId(currentUrl)
      if (ytId) {
        try {
          iframeEl.contentWindow?.postMessage(JSON.stringify({
            event: 'command',
            func: 'setVolume',
            args: [Math.round(newOpts.volume)]
          }), '*')
        } catch {}
      }
    }
    if (iframeEl) {
      if (newOpts.opacity !== undefined) iframeEl.style.opacity = String(newOpts.opacity)
      if (newOpts.brightness !== undefined) iframeEl.style.filter = `brightness(${newOpts.brightness})`
    }
  }

  return { start, stop, pause, resume, updateOptions }
}

export default createWebStream
