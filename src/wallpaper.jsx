/**
 * wallpaper.jsx — AuraOS Wallpaper Window Entry Point
 *
 * This is a completely separate React root from the main control panel.
 * It renders ONLY a full-screen canvas that animates the active wallpaper engine.
 *
 * Communication: Tauri backend emits events → this window reacts.
 *   'aura:set-engine'     { engineId, config }  — swap wallpaper engine
 *   'aura:update-config'  { ...config }          — hot-update config
 *   'aura:stop'           {}                     — stop and clear canvas
 *   'aura:set-brightness' { brightness }         — apply CSS filter
 *   'aura:set-opacity'    { opacity }            — apply CSS opacity
 */

import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ENGINES } from './engines/index.js'
import './styles/index.css'

// ─── WallpaperCanvas Component ────────────────────────────────────────────────

function WallpaperCanvas() {
  const canvasRef   = useRef(null)
  const engineRef   = useRef(null)
  const activeIdRef = useRef(null)
  const bootSeqRef  = useRef(0)

  const isScreensaver = typeof window !== 'undefined' && window.location.search.includes('mode=screensaver')
  const fadeInSecs = parseFloat(
    (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('fadeIn') : null) || '1.0'
  )
  const [activeId,   setActiveId]   = useState(null)
  const [opacity,    setOpacity]    = useState(1)
  const [brightness, setBrightness] = useState(0.85)
  const [fadeActive, setFadeActive] = useState(!isScreensaver)
  const [now, setNow] = useState(new Date())

  // Trigger smooth fade-in after mounting screensaver
  useEffect(() => {
    if (!isScreensaver) return
    const t = setTimeout(() => setFadeActive(true), 50)
    const clockTimer = setInterval(() => setNow(new Date()), 1000)
    return () => {
      clearTimeout(t)
      clearInterval(clockTimer)
    }
  }, [isScreensaver])

  // Screensaver user input wakeup detection (any mouse movement > 15px, click, or keypress cancels screensaver)
  useEffect(() => {
    if (!isScreensaver) return

    let dismissed = false
    const dismiss = async () => {
      if (dismissed) return
      dismissed = true
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('dismiss_screensaver')
      } catch (e) {
        console.warn('[Screensaver] Dismiss error:', e)
      }
    }

    let startPos = null
    const onMouseMove = (e) => {
      if (!startPos) {
        startPos = { x: e.clientX, y: e.clientY }
        return
      }
      const dist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y)
      if (dist > 15) {
        dismiss()
      }
    }

    const onKeyDown = () => dismiss()
    const onMouseDown = () => dismiss()
    const onWheel = () => dismiss()
    const onPointerDown = () => dismiss()

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('keydown', onKeyDown, { passive: true })
    window.addEventListener('mousedown', onMouseDown, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isScreensaver])

  function silenceAllMedia() {
    document.querySelectorAll('video, audio').forEach(media => {
      try {
        media.pause()
        media.muted = true
        media.volume = 0
        media.currentTime = 0
        media.src = ''
        media.removeAttribute('src')
        media.load()
        media.remove()
      } catch (e) {}
    })
    document.querySelectorAll('iframe, [data-aether-player]').forEach(frame => {
      try {
        if (frame.tagName === 'IFRAME') frame.src = 'about:blank'
        frame.remove()
      } catch (e) {}
    })
  }

  // ── Engine boot/swap ─────────────────────────────────────────────────────────
  async function bootEngine(engineId, config = {}) {
    const seq = ++bootSeqRef.current

    // Stop and destroy ANY current engine immediately
    if (engineRef.current) {
      try { engineRef.current.stop() } catch (e) {}
      engineRef.current = null
    }

    // Completely silence and remove any lingering audio/video media
    silenceAllMedia()

    if (!engineId) {
      activeIdRef.current = null
      setActiveId(null)
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        canvasRef.current.width = 1
        canvasRef.current.height = 1
      }
      return
    }

    let resolvedEngineId = engineId
    if (!ENGINES[resolvedEngineId]) {
      if (config?.videoPath) resolvedEngineId = 'video-player'
      else if (config?.imagePath) resolvedEngineId = 'image-player'
      else if (config?.streamUrl) resolvedEngineId = 'web-stream'
    }

    const descriptor = ENGINES[resolvedEngineId]
    if (!descriptor) {
      console.error('[AuraOS Wallpaper] Unknown engine:', engineId)
      return
    }

    activeIdRef.current = resolvedEngineId
    setActiveId(resolvedEngineId)

    try {
      const factory = await descriptor.load()
      
      // If a newer boot request or stop arrived while loading, abort!
      if (seq !== bootSeqRef.current) return

      // Ensure any previously running engine is stopped
      if (engineRef.current) {
        try { engineRef.current.stop() } catch (e) {}
        engineRef.current = null
      }
      silenceAllMedia()

      if (!canvasRef.current) return
      const engine = factory(canvasRef.current, config)
      engineRef.current = engine
      engine.start()
    } catch (err) {
      console.error('[AuraOS Wallpaper] Failed to load engine:', engineId, err)
    }
  }

  // ── Subscribe to Tauri events (dynamic import — no top-level await) ──────────
  useEffect(() => {
    let unlisteners = []

    async function setupListeners() {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const appWindow = getCurrentWindow()
        const myLabel = appWindow.label

        let globalListen = null
        try {
          const eventMod = await import('@tauri-apps/api/event')
          globalListen = eventMod.listen
        } catch (e) {}

        let lastEventKey = ''
        let lastEventTime = 0

        async function addListener(eventName, handler) {
          const wrapped = ({ payload }) => {
            if (payload?.target && payload.target !== '*' && payload.target !== myLabel) {
              return
            }
            const now = Date.now()
            const key = eventName + ':' + JSON.stringify(payload || {})
            if (key === lastEventKey && (now - lastEventTime) < 150) {
              return
            }
            lastEventKey = key
            lastEventTime = now
            handler(payload)
          }
          unlisteners.push(await appWindow.listen(eventName, wrapped))
          if (globalListen) {
            try {
              unlisteners.push(await globalListen(eventName, wrapped))
            } catch (e) {}
          }
        }

        await addListener('aura:set-engine', (payload) => {
          const cfg = { ...(payload?.config || {}) }
          const isSecondaryScreen = Boolean(cfg.isSecondary)
          if (isSecondaryScreen) {
            cfg.isSecondary = true
            cfg.muted = true
            cfg.volume = 0
          }
          bootEngine(payload?.engineId, cfg)
        })

        await addListener('aura:update-config', (payload) => {
          const cfg = { ...(payload?.config || payload || {}) }
          const isSecondaryScreen = Boolean(cfg.isSecondary)
          if (isSecondaryScreen) {
            cfg.isSecondary = true
            cfg.muted = true
            cfg.volume = 0
          }
          engineRef.current?.updateOptions?.(cfg)
        })

        await addListener('aura:stop', () => {
          bootSeqRef.current++
          activeIdRef.current = null
          setActiveId(null)
          if (engineRef.current) {
            try { engineRef.current.stop() } catch (e) {}
            engineRef.current = null
          }
          silenceAllMedia()
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d')
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
            canvasRef.current.width = 1
            canvasRef.current.height = 1
          }
        })

        await addListener('aura:pause', () => {
          try { engineRef.current?.pause?.() } catch (e) {}
          try { engineRef.current?.updateOptions?.({ paused: true }) } catch (e) {}
          document.querySelectorAll('video, audio').forEach(el => {
            try { el.pause() } catch (e) {}
          })
        })

        await addListener('aura:resume', () => {
          try { engineRef.current?.resume?.() } catch (e) {}
          try { engineRef.current?.updateOptions?.({ paused: false }) } catch (e) {}
          document.querySelectorAll('video').forEach(el => {
            try { el.play().catch(() => {}) } catch (e) {}
          })
        })

        await addListener('aura:mute', () => {
          document.querySelectorAll('video, audio').forEach(el => {
            try { el.muted = true } catch (e) {}
          })
          try { engineRef.current?.updateOptions?.({ muted: true }) } catch (e) {}
        })

        await addListener('aura:unmute', () => {
          document.querySelectorAll('video, audio').forEach(el => {
            try { el.muted = false } catch (e) {}
          })
          try { engineRef.current?.updateOptions?.({ muted: false }) } catch (e) {}
        })

        await addListener('aura:set-brightness', (payload) => {
          if (payload?.brightness !== undefined) setBrightness(payload.brightness)
        })

        await addListener('aura:set-opacity', (payload) => {
          if (payload?.opacity !== undefined) setOpacity(payload.opacity)
        })

        await addListener('aura:set-fps', (payload) => {
          if (payload?.fps) {
            engineRef.current?.updateOptions?.({ fps: payload.fps })
          }
        })

        // Check if there is already an active wallpaper for this monitor (handles hot-plug & reload)
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          if (isScreensaver) {
            const screensaverData = await invoke('get_screensaver_active_wallpaper')
            if (screensaverData?.engineId && screensaverData.engineId !== 'blackout') {
              const cfg = { ...(screensaverData.config || {}) }
              if (screensaverData.muteAudio) {
                cfg.muted = true
                cfg.volume = 0
              }
              bootEngine(screensaverData.engineId, cfg)
            }
          } else {
            const activeState = await invoke('get_monitor_active_wallpaper', { label: myLabel })
            if (activeState?.engineId) {
              bootEngine(activeState.engineId, activeState.config || {})
              if (activeState.brightness !== undefined) setBrightness(activeState.brightness)
              if (activeState.opacity !== undefined) setOpacity(activeState.opacity)
            }
          }
        } catch (e) {
          console.warn('[AuraOS Wallpaper] initialization query failed:', e)
        }
      } catch (err) {
        // Only auto-boot in a regular browser (NOT inside Tauri)
        if (!window.__TAURI_INTERNALS__) {
          console.warn('[AuraOS Wallpaper] Tauri not available, loading preview engine')
          const firstId = Object.keys(ENGINES)[0]
          if (firstId) bootEngine(firstId, ENGINES[firstId].defaultConfig)
        }
      }
    }

    setupListeners()

    return () => {
      // Unsubscribe all Tauri event listeners on unmount
      unlisteners.forEach(fn => fn?.())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup engine on component unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.stop()
        engineRef.current = null
      }
    }
  }, [])

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#000',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          opacity: isScreensaver ? (fadeActive ? opacity : 0) : opacity,
          filter: `brightness(${brightness})`,
          transition: isScreensaver ? `opacity ${fadeInSecs}s cubic-bezier(0.16, 1, 0.3, 1)` : undefined,
          pointerEvents: 'none',
          background: '#000',
        }}
        aria-hidden="true"
      />

      {isScreensaver && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 48,
            zIndex: 9999,
            pointerEvents: 'none',
            userSelect: 'none',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#fff',
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.85)',
            opacity: fadeActive ? 1 : 0,
            transition: `opacity ${fadeInSecs}s cubic-bezier(0.16, 1, 0.3, 1)`,
          }}
        >
          <div style={{ fontSize: '4.25rem', fontWeight: 200, letterSpacing: '-1.5px', lineHeight: 1 }}>
            {timeStr}
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 400, opacity: 0.8, marginTop: 8, letterSpacing: '0.2px' }}>
            {dateStr}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              opacity: 0.7,
              marginTop: 18,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-brand, #3b82f6)' }} />
            <span>AetherFlow Screensaver • Move mouse to wake</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Mount ────────────────────────────────────────────────────────────────────

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(<WallpaperCanvas />)
}
