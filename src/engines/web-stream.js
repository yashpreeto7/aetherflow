/**
 * Web Stream & YouTube Wallpaper Engine
 * Renders live streams, ambient YouTube loops, or interactive web pages as wallpapers.
 * - Canvas 2D fallback for lightweight grid previews
 * - Native YouTube IFrame API (YT.Player) integration for borderless, infinite-looping playback
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

let ytApiPromise = null
function loadYouTubeApi() {
  if (typeof window !== 'undefined' && window.YT && window.YT.Player) {
    return Promise.resolve(window.YT)
  }
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev()
        resolve(window.YT)
      }
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
    })
  }
  return ytApiPromise
}

export function createWebStream(canvas, options = {}) {
  const ctx = canvas.getContext('2d')
  let animId = null
  let containerEl = null
  let iframeEl = null
  let ytPlayer = null
  let loopTimer = null
  let thumbImg = null
  let thumbLoaded = false
  let currentUrl = options.streamUrl || ''
  let currentMuted = options.muted ?? true
  let isRunning = false
  let isPausedByUser = false

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

  function mountPlayer() {
    if (options.preview) return
    if (!canvas.parentElement) return

    unmountPlayer()

    const ytId = parseYouTubeId(currentUrl)

    if (ytId) {
      // Container with overscan to push any YouTube edge elements completely off-screen
      containerEl = document.createElement('div')
      containerEl.setAttribute('data-aether-player', 'youtube')
      containerEl.style.position = 'absolute'
      containerEl.style.top = '-60px'
      containerEl.style.left = '-60px'
      containerEl.style.width = 'calc(100% + 120px)'
      containerEl.style.height = 'calc(100% + 120px)'
      containerEl.style.pointerEvents = 'none'
      containerEl.style.zIndex = '1'
      containerEl.style.opacity = String(options.opacity ?? 1)
      containerEl.style.filter = `brightness(${options.brightness ?? 1})`
      containerEl.style.overflow = 'hidden'

      const playerMount = document.createElement('div')
      playerMount.id = 'yt-mount-' + Math.random().toString(36).slice(2)
      playerMount.style.width = '100%'
      playerMount.style.height = '100%'
      containerEl.appendChild(playerMount)
      canvas.parentElement.appendChild(containerEl)

      loadYouTubeApi().then((YT) => {
        if (!isRunning || !containerEl) return
        ytPlayer = new YT.Player(playerMount.id, {
          videoId: ytId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: (e) => {
              if (currentMuted) e.target.mute()
              else e.target.unMute()
              if (options.volume !== undefined) {
                e.target.setVolume(Math.round(options.volume))
              }
              e.target.playVideo()

              // Proactive rewind: checks every 100ms and loops BEFORE video reaches the end
              // Prevents pause, replay icon, and media controls from ever appearing
              clearInterval(loopTimer)
              loopTimer = setInterval(() => {
                if (ytPlayer?.getCurrentTime && ytPlayer?.getDuration && isRunning && !isPausedByUser) {
                  const cur = ytPlayer.getCurrentTime()
                  const dur = ytPlayer.getDuration()
                  if (dur > 1.5 && cur >= dur - 0.25) {
                    ytPlayer.seekTo(0, true)
                  }
                }
              }, 100)
            },
            onStateChange: (e) => {
              // 0 = ENDED: instantaneous rewind fallback
              if (e.data === 0 && isRunning && !isPausedByUser) {
                e.target.seekTo(0, true)
                e.target.playVideo()
              }
            }
          }
        })
      })
    } else {
      // General web URL / WebGL interactive wallpaper
      iframeEl = document.createElement('iframe')
      iframeEl.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen')
      iframeEl.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
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
      iframeEl.src = currentUrl
      canvas.parentElement.appendChild(iframeEl)
    }
  }

  function unmountPlayer() {
    if (loopTimer) {
      clearInterval(loopTimer)
      loopTimer = null
    }
    if (ytPlayer) {
      try { ytPlayer.destroy() } catch {}
      ytPlayer = null
    }
    if (containerEl) {
      try { containerEl.remove() } catch {}
      containerEl = null
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
      mountPlayer()
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
    unmountPlayer()
  }

  function pause() {
    isPausedByUser = true
    if (ytPlayer?.pauseVideo) {
      try { ytPlayer.pauseVideo() } catch {}
    }
  }

  function resume() {
    isPausedByUser = false
    if (ytPlayer?.playVideo) {
      try { ytPlayer.playVideo() } catch {}
    }
  }

  function updateOptions(newOpts = {}) {
    Object.assign(options, newOpts)
    if (newOpts.streamUrl !== undefined && newOpts.streamUrl !== currentUrl) {
      currentUrl = newOpts.streamUrl
      const ytId = parseYouTubeId(currentUrl)
      if (ytId) loadThumbnail(ytId)
      if (!options.preview) mountPlayer()
    }
    if (newOpts.muted !== undefined && newOpts.muted !== currentMuted) {
      currentMuted = newOpts.muted
      if (ytPlayer) {
        try {
          if (currentMuted) ytPlayer.mute()
          else ytPlayer.unMute()
        } catch {}
      }
    }
    if (newOpts.volume !== undefined && ytPlayer?.setVolume) {
      try { ytPlayer.setVolume(Math.round(newOpts.volume)) } catch {}
    }
    if (newOpts.opacity !== undefined) {
      if (containerEl) containerEl.style.opacity = String(newOpts.opacity)
      if (iframeEl) iframeEl.style.opacity = String(newOpts.opacity)
    }
    if (newOpts.brightness !== undefined) {
      if (containerEl) containerEl.style.filter = `brightness(${newOpts.brightness})`
      if (iframeEl) iframeEl.style.filter = `brightness(${newOpts.brightness})`
    }
  }

  return { start, stop, pause, resume, updateOptions }
}

export default createWebStream
