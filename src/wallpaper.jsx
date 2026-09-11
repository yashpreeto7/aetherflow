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
          const activeState = await invoke('get_monitor_active_wallpaper', { label: myLabel })
          if (activeState?.engineId) {
            bootEngine(activeState.engineId, activeState.config || {})
            if (activeState.brightness !== undefined) setBrightness(activeState.brightness)
            if (activeState.opacity !== undefined) setOpacity(activeState.opacity)
          }
        } catch (e) {
          console.warn('[AuraOS Wallpaper] get_monitor_active_wallpaper query failed:', e)
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

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        opacity,
        filter: `brightness(${brightness})`,
        pointerEvents: 'none',
        background: '#000',
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
