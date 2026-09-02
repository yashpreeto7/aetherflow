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
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const activeIdRef = useRef(null)

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

  // ── Boot / swap engine ─────────────────────────────────────────────────────
  const bootEngine = useCallback(async () => {
    if (!canvasRef.current || !engineId) return

    // Stop previous engine cleanly
    if (engineRef.current) {
      engineRef.current.stop()
      engineRef.current = null
    }

    const descriptor = ENGINES[engineId]
    if (!descriptor) return

    try {
      const factory = await descriptor.load()
      // Don't start if engine changed while loading
      if (activeIdRef.current !== engineId) return

      const engine = factory(canvasRef.current, mergedConfig)
      engineRef.current = engine
      engine.start()
    } catch (err) {
      console.error('AuraOS: Failed to load engine', engineId, err)
    }
  }, [engineId]) // Re-mount only when engine ID changes

  useEffect(() => {
    activeIdRef.current = engineId
    bootEngine()
    return () => {
      if (engineRef.current) {
        engineRef.current.stop()
        engineRef.current = null
      }
    }
  }, [engineId, bootEngine])

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
