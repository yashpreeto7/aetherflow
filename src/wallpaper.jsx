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

  const [activeId,   setActiveId]   = useState(null)
  const [opacity,    setOpacity]    = useState(1)
  const [brightness, setBrightness] = useState(0.85)

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
      }
      return
    }

    const descriptor = ENGINES[engineId]
    if (!descriptor) {
      console.error('[AuraOS Wallpaper] Unknown engine:', engineId)
      return
    }

    activeIdRef.current = engineId
    setActiveId(engineId)

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

        unlisteners.push(
          await appWindow.listen('aura:set-engine', ({ payload }) => {
            bootEngine(payload.engineId, payload.config || {})
          })
        )

        unlisteners.push(
          await appWindow.listen('aura:update-config', ({ payload }) => {
            engineRef.current?.updateOptions?.(payload)
          })
        )

        unlisteners.push(
          await appWindow.listen('aura:stop', () => {
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
            }
          })
        )

        unlisteners.push(
          await appWindow.listen('aura:pause', () => {
            if (engineRef.current && engineRef.current.updateOptions) {
               engineRef.current.updateOptions({ paused: true });
            } else {
               setOpacity(0);
            }
          })
        )

        unlisteners.push(
          await appWindow.listen('aura:resume', () => {
            if (engineRef.current && engineRef.current.updateOptions) {
               engineRef.current.updateOptions({ paused: false });
            } else {
               setOpacity(1);
            }
          })
        )

        unlisteners.push(
          await appWindow.listen('aura:set-brightness', ({ payload }) => {
            setBrightness(payload.brightness)
          })
        )

        unlisteners.push(
          await appWindow.listen('aura:set-opacity', ({ payload }) => {
            setOpacity(payload.opacity)
          })
        )
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

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        display: 'block',
        opacity,
        filter: `brightness(${brightness})`,
        pointerEvents: 'none',
        background: activeId ? '#000' : 'transparent',
      }}
      aria-hidden="true"
    />
  )
}

// ─── Mount ────────────────────────────────────────────────────────────────────

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(<WallpaperCanvas />)
}
