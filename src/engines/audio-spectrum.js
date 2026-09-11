/**
 * Audio Spectrum Visualizer Engine
 * Canvas 2D + Web Audio API — CAVA-style frequency bars reactive to mic or tab audio.
 * Gracefully falls back to a beat-simulated idle animation when no audio source.
 * In preview mode (thumbnail cards), skips mic request entirely and uses idle animation.
 * ~4KB, zero dependencies.
 */

export function createAudioSpectrum(canvas, options = {}) {
  let {
    color = '#00d4ff',
    accentColor = '#ff2d78',
    barCount = 80,
    smoothing = 0.82,
    source = 'mic',   // 'mic' | 'system' (system = loopback, browser-limited)
    mirror = true,
    speedMultiplier = 1,
    preview = false,  // true = thumbnail card mode, skip mic request
    useMic = false,   // true = request mic for live sound, false = beat simulation
    audioDeviceId = 'default',
    fps = 60,
  } = options

  const ctx = canvas.getContext('2d')
  let animId = null
  let audioCtx = null
  let analyser = null
  let dataArray = null
  let stream = null
  let lastFrame = 0

  // Idle simulation (used in preview mode, default simulation, and when mic is denied)
  let idleTime = 0

  function resize() {
    canvas.width = canvas.offsetWidth || window.innerWidth
    canvas.height = canvas.offsetHeight || window.innerHeight
  }

  async function initAudio() {
    // Skip mic request entirely in preview/thumbnail mode or if microphone input is not enabled
    if (preview || !options.useMic) return false

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      } else if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {})
      }
      if (!analyser) {
        analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = smoothing
      }

      if (stream) {
        stream.getTracks().forEach(t => t.stop())
        stream = null
      }

      const activeDevId = options.audioDeviceId || audioDeviceId || 'default'
      const constraints = {
        audio: (activeDevId && activeDevId !== 'default')
          ? { deviceId: { exact: activeDevId } }
          : true,
        video: false
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (devErr) {
        if (activeDevId !== 'default') {
          console.warn('[AetherFlow Audio] Selected audio device unavailable, falling back to default device:', devErr)
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        } else {
          throw devErr
        }
      }

      const src = audioCtx.createMediaStreamSource(stream)
      src.connect(analyser)

      dataArray = new Uint8Array(analyser.frequencyBinCount)
      return true
    } catch (e) {
      console.warn('AuraOS Audio: microphone/device not available, using idle simulation', e)
      return false
    }
  }

  function hexToRgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  }

  function drawBars(freqData) {
    const W = canvas.width
    const H = canvas.height
    const halfBars = mirror ? Math.floor(barCount / 2) : barCount
    const barW = (mirror ? W / 2 : W) / halfBars - 1

    ctx.clearRect(0, 0, W, H)

    const [r1, g1, b1] = hexToRgb(color)
    const [r2, g2, b2] = hexToRgb(accentColor)

    for (let i = 0; i < halfBars; i++) {
      const idx = Math.floor(i / halfBars * (freqData.length || halfBars))
      const rawVal = freqData[idx] ?? 0
      const barH = (rawVal / 255) * H * 0.8

      const t = rawVal / 255
      const r = Math.round(r1 + (r2 - r1) * t)
      const g = Math.round(g1 + (g2 - g1) * t)
      const b = Math.round(b1 + (b2 - b1) * t)

      const grad = ctx.createLinearGradient(0, H - barH, 0, H)
      grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`)
      grad.addColorStop(1, `rgba(${r},${g},${b},0.2)`)
      ctx.fillStyle = grad

      const x = i * (barW + 1)
      ctx.beginPath()
      ctx.roundRect(x, H - barH, barW, barH, [3, 3, 0, 0])
      ctx.fill()

      if (mirror) {
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect(W - x - barW, H - barH, barW, barH, [3, 3, 0, 0])
        ctx.fill()
      }
    }
  }

  function idleFrame() {
    const fake = new Uint8Array(barCount)
    for (let i = 0; i < barCount; i++) {
      fake[i] = 30 + Math.abs(Math.sin(idleTime * speedMultiplier + i * 0.3)) * 80
        + Math.sin(idleTime * speedMultiplier * 2 + i * 0.5) * 20
    }
    idleTime += 0.025
    return fake
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

    let freqData
    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray)
      freqData = dataArray
    } else {
      freqData = idleFrame()
    }
    drawBars(freqData)
  }

  function start() {
    resize()
    window.addEventListener('resize', resize)
    animId = requestAnimationFrame(frame)
    if (options.useMic && !preview) {
      initAudio().catch(e => console.warn('AuraOS Audio init error:', e))
    }
  }

  function stop() {
    if (animId) cancelAnimationFrame(animId)
    window.removeEventListener('resize', resize)
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      stream = null
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {})
      audioCtx = null
    }
    analyser = null
    dataArray = null
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
    const prevUseMic = options.useMic
    const prevDevId = options.audioDeviceId || audioDeviceId || 'default'
    Object.assign(options, newOpts)
    if (newOpts.audioDeviceId !== undefined) {
      audioDeviceId = newOpts.audioDeviceId
    }
    if (newOpts.speedMultiplier !== undefined) speedMultiplier = newOpts.speedMultiplier
    if (newOpts.fps !== undefined) fps = newOpts.fps
    if (newOpts.color !== undefined) color = newOpts.color
    if (newOpts.accentColor !== undefined) accentColor = newOpts.accentColor
    if (newOpts.barCount !== undefined) barCount = newOpts.barCount
    if (newOpts.paused !== undefined) {
      if (newOpts.paused) pause()
      else resume()
    }
    if (analyser) analyser.smoothingTimeConstant = options.smoothing ?? smoothing

    const nextDevId = options.audioDeviceId || audioDeviceId || 'default'
    if (options.useMic && !preview) {
      if (!prevUseMic || nextDevId !== prevDevId || !stream) {
        initAudio().catch(e => console.warn('AuraOS Audio init error:', e))
      }
    } else if (prevUseMic && !options.useMic && stream) {
      stream.getTracks().forEach(t => t.stop())
      stream = null
      if (audioCtx) {
        audioCtx.close().catch(() => {})
        audioCtx = null
      }
      analyser = null
      dataArray = null
    }
  }

  return { start, stop, updateOptions, pause, resume }
}
