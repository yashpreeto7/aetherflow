import React, { useEffect, useRef, useCallback } from 'react'
import { ENGINES } from '../../engines/index.js'
import { useStore } from '../../store/useStore.js'

/**
 * WallpaperPlayer
 * Mounts and manages the active wallpaper engine on a full-screen canvas.
 *
 * Props:
 *   engineId   — engine key from ENGINES registry
 *   config     — engine-specific config object
 *   preview    — if true, renders in a small preview card (no opacity/brightness applied)
 *   style      — extra style overrides
 */
export default function WallpaperPlayer({ engineId, config = {}, preview = false, style = {} }) {
  const canvasRef     = useRef(null)
  const engineRef     = useRef(null)
  const bootSeqRef    = useRef(0)
  const isMountedRef  = useRef(true)

  const wallpaperOpacity    = useStore(s => s.wallpaperOpacity)
  const wallpaperBrightness = useStore(s => s.wallpaperBrightness)
  const wallpaperSpeed      = useStore(s => s.wallpaperSpeed)
  const audioVolume         = useStore(s => s.audioVolume)
  const audioMuted          = useStore(s => s.audioMuted)
  const fps                 = useStore(s => s.fps)

  // ── Merge global speed + preview flag into per-engine config ──────────────
  const mergedConfig = {
    ...config,
    speedMultiplier: (config.speedMultiplier ?? 1) * wallpaperSpeed,
    volume: audioVolume,
    muted: audioMuted,
    preview,   // audio-spectrum uses this to skip mic request in thumbnail mode
  }

  const silenceLocalMedia = useCallback(() => {
    if (canvasRef.current?.parentNode) {
      canvasRef.current.parentNode.querySelectorAll('video, audio').forEach(media => {
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
  }, [])

  // ── Boot / swap engine ─────────────────────────────────────────────────────
  const bootEngine = useCallback(async () => {
    const seq = ++bootSeqRef.current
    if (!canvasRef.current || !engineId) return

    // Stop previous engine cleanly
    if (engineRef.current) {
      try { engineRef.current.stop() } catch (e) {}
      engineRef.current = null
    }

    silenceLocalMedia()

    const descriptor = ENGINES[engineId]
    if (!descriptor) return

    try {
      const factory = await descriptor.load()
      // If unmounted or a newer boot arrived while loading, abort!
      if (!isMountedRef.current || seq !== bootSeqRef.current) return

      // Ensure canvas has valid dimensions immediately
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const w = rect.width || canvasRef.current.offsetWidth || canvasRef.current.parentElement?.offsetWidth || 320
        const h = rect.height || canvasRef.current.offsetHeight || canvasRef.current.parentElement?.offsetHeight || 180
        canvasRef.current.width = Math.max(Math.round(w), 100)
        canvasRef.current.height = Math.max(Math.round(h), 60)

        const engine = factory(canvasRef.current, mergedConfig)
        engineRef.current = engine
        engine.start()
      }
    } catch (err) {
      console.error('AuraOS: Failed to load engine', engineId, err)
    }
  }, [engineId, silenceLocalMedia]) // Re-mount only when engine ID changes

  useEffect(() => {
    isMountedRef.current = true
    bootEngine()
    return () => {
      isMountedRef.current = false
      bootSeqRef.current++
      if (engineRef.current) {
        try { engineRef.current.stop() } catch (e) {}
        engineRef.current = null
      }
      silenceLocalMedia()
    }
  }, [engineId, bootEngine, silenceLocalMedia])

  // ── Live-update config without remounting ──────────────────────────────────
  useEffect(() => {
    if (engineRef.current?.updateOptions) {
      engineRef.current.updateOptions(mergedConfig)
    }
  }, [config, wallpaperSpeed, audioVolume, audioMuted])

  // ── Styles ─────────────────────────────────────────────────────────────────
  const canvasStyle = preview
    ? {
        width: '100%',
        height: '100%',
        borderRadius: 8,
        display: 'block',
      }
    : {
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        opacity: wallpaperOpacity,
        filter: `brightness(${wallpaperBrightness})`,
        pointerEvents: 'none',
      }

  return (
    <canvas
      ref={canvasRef}
      style={{ ...canvasStyle, ...style }}
      aria-hidden="true"
    />
  )
}
