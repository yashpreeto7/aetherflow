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
  let wrapA = null
  let wrapB = null
  let playerA = null
  let playerB = null
  let activeSlot = 'A'
  let hasFadedIn = false
  let isTransitioning = false
  let crossfadeTimer = null
  let loopTimer = null
  let syncInterval = null
  const syncChannel = (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined')
    ? new BroadcastChannel('aetherflow_yt_sync')
    : null
  let iframeEl = null
  let thumbImg = null
  let thumbLoaded = false
  let currentUrl = options.streamUrl || options.url || ''
  let isSecondary = Boolean(options.isSecondary)
  let currentMuted = isSecondary ? true : (options.muted ?? true)
  let currentSpeed = Number(options.speedMultiplier ?? options.speed ?? 1)
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
      containerEl.style.filter = `brightness(${options.brightness ?? 1})`
      containerEl.style.overflow = 'hidden'

      // Slot A wrapper
      wrapA = document.createElement('div')
      wrapA.style.position = 'absolute'
      wrapA.style.inset = '0'
      wrapA.style.opacity = String(options.opacity ?? 1)
      wrapA.style.transition = 'opacity 0.4s ease'
      const mountA = document.createElement('div')
      mountA.id = 'yt-mount-a-' + Math.random().toString(36).slice(2)
      mountA.style.width = '100%'
      mountA.style.height = '100%'
      wrapA.appendChild(mountA)
      containerEl.appendChild(wrapA)

      // Slot B wrapper (for seamless ping-pong loop without bezel)
      wrapB = document.createElement('div')
      wrapB.style.position = 'absolute'
      wrapB.style.inset = '0'
      wrapB.style.opacity = '0'
      wrapB.style.transition = 'opacity 0.4s ease'
      const mountB = document.createElement('div')
      mountB.id = 'yt-mount-b-' + Math.random().toString(36).slice(2)
      mountB.style.width = '100%'
      mountB.style.height = '100%'
      wrapB.appendChild(mountB)
      containerEl.appendChild(wrapB)

      canvas.parentElement.appendChild(containerEl)

      loadYouTubeApi().then((YT) => {
        if (!isRunning || !containerEl) return

        function makeConfig(slot, onReadyCb) {
          return {
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
              mute: currentMuted ? 1 : 0,
              loop: 0,
              enablejsapi: 1,
            },
            events: {
              onReady: (e) => {
                if (currentMuted) e.target.mute()
                else e.target.unMute()
                if (options.volume !== undefined) {
                  e.target.setVolume(Math.round(options.volume))
                }
                if (currentSpeed !== 1 && e.target.setPlaybackRate) {
                  try { e.target.setPlaybackRate(currentSpeed) } catch {}
                }
                onReadyCb?.(e)
              },
              onStateChange: (e) => {
                if (e.data === 1 && !hasFadedIn && slot === 'A') {
                  hasFadedIn = true
                  if (wrapA) wrapA.style.opacity = String(options.opacity ?? 1)
                }
                // Genuine ENDED fallback if loop timer missed
                if (e.data === 0 && isRunning && !isPausedByUser) {
                  triggerLoopTransition()
                }
              }
            }
          }
        }

        function triggerLoopTransition() {
          if (isTransitioning || !isRunning || isPausedByUser) return
          isTransitioning = true

          const currentActive = activeSlot === 'A' ? playerA : playerB
          const nextWrap = activeSlot === 'A' ? wrapB : wrapA

          function runNext(nextPlayer) {
            // Next player begins seeking & playing at opacity: 0
            nextWrap.style.opacity = '0'
            try {
              if (currentMuted) nextPlayer.mute()
              else nextPlayer.unMute()
              if (currentSpeed !== 1 && nextPlayer.setPlaybackRate) {
                nextPlayer.setPlaybackRate(currentSpeed)
              }
              nextPlayer.seekTo(0, true)
              nextPlayer.playVideo()
            } catch {}

            clearTimeout(crossfadeTimer)
            crossfadeTimer = setTimeout(() => {
              if (!isRunning) return
              // Crossfade: next player fades in, previous fades out
              nextWrap.style.opacity = String(options.opacity ?? 1)
              const prevWrap = activeSlot === 'A' ? wrapA : wrapB
              if (prevWrap) prevWrap.style.opacity = '0'

              setTimeout(() => {
                if (!isRunning) return
                try { currentActive?.pauseVideo() } catch {}
                activeSlot = activeSlot === 'A' ? 'B' : 'A'
                isTransitioning = false
              }, 450)
            }, 300)
          }

          if (activeSlot === 'A') {
            if (!playerB) {
              playerB = new YT.Player(mountB.id, makeConfig('B', () => {
                runNext(playerB)
              }))
            } else {
              runNext(playerB)
            }
          } else {
            runNext(playerA)
          }
        }

        function startLoopMonitor() {
          clearInterval(loopTimer)
          loopTimer = setInterval(() => {
            if (!isRunning || isPausedByUser || isTransitioning) return
            const activePlayer = activeSlot === 'A' ? playerA : playerB
            if (!activePlayer?.getCurrentTime || !activePlayer?.getDuration) return

            const cur = activePlayer.getCurrentTime()
            const dur = activePlayer.getDuration()

            // If valid duration, initiate seamless ping-pong transition 2.4s before end
            if (dur > 3 && cur >= dur - 2.4) {
              triggerLoopTransition()
            }
          }, 150)
        }

        function startSyncMonitor() {
          if (!syncChannel) return
          if (!currentMuted) {
            // Master screen: broadcast audio-synced timestamp to secondary screens
            clearInterval(syncInterval)
            syncInterval = setInterval(() => {
              if (!isRunning || isPausedByUser) return
              const activePlayer = activeSlot === 'A' ? playerA : playerB
              if (activePlayer && activePlayer.getCurrentTime && activePlayer.getPlayerState?.() === 1) {
                try {
                  syncChannel.postMessage({ type: 'sync_time', ytId, time: activePlayer.getCurrentTime() })
                } catch (e) {}
              }
            }, 1000)
          } else {
            // Secondary screen: keep video frame in exact lockstep while remaining muted
            syncChannel.onmessage = (ev) => {
              if (!isRunning || isPausedByUser) return
              if (ev.data?.type === 'sync_time' && ev.data?.ytId === ytId) {
                const activePlayer = activeSlot === 'A' ? playerA : playerB
                if (activePlayer && activePlayer.getCurrentTime && activePlayer.getPlayerState?.() === 1) {
                  try {
                    const currentT = activePlayer.getCurrentTime()
                    if (Math.abs(currentT - ev.data.time) > 0.45) {
                      activePlayer.seekTo(ev.data.time, true)
                    }
                  } catch (e) {}
                }
              }
            }
          }
        }

        // Initialize Player A
        playerA = new YT.Player(mountA.id, makeConfig('A', (e) => {
          e.target.playVideo()
          startLoopMonitor()
          startSyncMonitor()
        }))
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
    clearInterval(loopTimer)
    loopTimer = null
    clearInterval(syncInterval)
    syncInterval = null
    clearTimeout(crossfadeTimer)
    crossfadeTimer = null

    if (playerA) {
      try { playerA.destroy() } catch {}
      playerA = null
    }
    if (playerB) {
      try { playerB.destroy() } catch {}
      playerB = null
    }
    if (containerEl) {
      try { containerEl.remove() } catch {}
      containerEl = null
      wrapA = null
      wrapB = null
    }
    if (iframeEl) {
      try {
        iframeEl.src = 'about:blank'
        iframeEl.remove()
      } catch {}
      iframeEl = null
    }
    hasFadedIn = false
    isTransitioning = false
    activeSlot = 'A'
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
    const activePlayer = activeSlot === 'A' ? playerA : playerB
    try { activePlayer?.pauseVideo() } catch {}
  }

  function resume() {
    isPausedByUser = false
    const activePlayer = activeSlot === 'A' ? playerA : playerB
    try {
      activePlayer?.playVideo()
      if (currentSpeed !== 1 && activePlayer?.setPlaybackRate) {
        activePlayer.setPlaybackRate(currentSpeed)
      }
    } catch {}
  }

  function updateOptions(newOpts = {}) {
    Object.assign(options, newOpts)
    const nextUrl = newOpts.streamUrl ?? newOpts.url
    if (nextUrl !== undefined && nextUrl !== currentUrl) {
      currentUrl = nextUrl
      const ytId = parseYouTubeId(currentUrl)
      if (ytId) loadThumbnail(ytId)
      if (!options.preview) mountPlayer()
    }
    if (newOpts.speedMultiplier !== undefined || newOpts.speed !== undefined) {
      currentSpeed = Number(newOpts.speedMultiplier ?? newOpts.speed ?? 1)
      try { playerA?.setPlaybackRate(currentSpeed) } catch {}
      try { playerB?.setPlaybackRate(currentSpeed) } catch {}
    }
    if (newOpts.paused !== undefined) {
      if (newOpts.paused) pause()
      else resume()
    }
    if (newOpts.isSecondary !== undefined) {
      isSecondary = Boolean(newOpts.isSecondary)
    }
    if (isSecondary) {
      currentMuted = true
      try {
        playerA?.mute()
        playerB?.mute()
        playerA?.setVolume(0)
        playerB?.setVolume(0)
      } catch {}
    } else {
      if (newOpts.muted !== undefined && newOpts.muted !== currentMuted) {
        currentMuted = newOpts.muted
        try {
          if (currentMuted) {
            playerA?.mute()
            playerB?.mute()
          } else {
            const active = activeSlot === 'A' ? playerA : playerB
            active?.unMute()
          }
        } catch {}
      }
      if (newOpts.volume !== undefined) {
        const vol = Math.round(newOpts.volume)
        try { playerA?.setVolume(vol) } catch {}
        try { playerB?.setVolume(vol) } catch {}
      }
    }
    if (newOpts.opacity !== undefined) {
      const activeWrap = activeSlot === 'A' ? wrapA : wrapB
      if (hasFadedIn && activeWrap) activeWrap.style.opacity = String(newOpts.opacity)
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
