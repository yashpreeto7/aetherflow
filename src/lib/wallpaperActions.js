import { useStore } from '../store/useStore.js'

/**
 * Tauri invoke wrapper that fails gracefully when running in web browser dev mode
 */
export async function tauriInvoke(cmd, args) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke(cmd, args)
  } catch {
    console.warn('[AuraOS] Tauri not available — command skipped:', cmd)
    return null
  }
}

/**
 * Applies any wallpaper (built-in or custom video) to the Windows desktop
 * directly via Tauri backend.
 */
export async function applyWallpaperToDesktop(wallpaper, options = {}) {
  if (!wallpaper) return false

  const state = useStore.getState()
  const targetLabel = options.targetMonitor ?? (state.screenArrangement === 'per-screen' ? options.selectedMonitorLabel : null)
  
  const speed = options.speed ?? state.wallpaperSpeed ?? 1
  const volume = options.volume ?? state.audioVolume ?? 50
  const muted = options.muted ?? state.audioMuted ?? false
  const opacity = options.opacity ?? state.wallpaperOpacity ?? 1
  const brightness = options.brightness ?? state.wallpaperBrightness ?? 0.85

  try {
    await tauriInvoke('apply_wallpaper', {
      engineId: wallpaper.engine,
      config: {
        ...(wallpaper.config || {}),
        speedMultiplier: speed,
        volume,
        muted,
      },
      opacity,
      brightness,
      monitorLabel: targetLabel || null,
    })

    // Update Zustand state
    state.setActiveWallpaper(wallpaper)
    state.setWallpaperRunning(true)
    if (targetLabel) {
      state.setMonitorWallpaper(targetLabel, wallpaper)
    }

    return true
  } catch (err) {
    console.error('[AuraOS] Failed to apply wallpaper to desktop:', err)
    return false
  }
}

/**
 * Stops live wallpaper on one or all monitors
 */
export async function stopDesktopWallpaper(targetMonitor = null) {
  const state = useStore.getState()
  try {
    await tauriInvoke('stop_wallpaper', { monitorLabel: targetMonitor || null })
    if (targetMonitor) {
      state.setMonitorWallpaper(targetMonitor, null)
    } else {
      state.setWallpaperRunning(false)
    }
    return true
  } catch (err) {
    console.error('[AuraOS] Failed to stop wallpaper:', err)
    return false
  }
}

/**
 * Opens native file dialog to import a video wallpaper and adds it to Library
 */
export async function importWallpaperDialog() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Video Wallpapers',
        extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov']
      }]
    })

    if (selected) {
      const path = typeof selected === 'string' ? selected : selected[0]
      if (!path) return null

      return addCustomVideoWallpaper(path)
    }
  } catch (err) {
    console.error('[AuraOS] Failed to open import dialog:', err)
  }
  return null
}

/**
 * Adds a video file path into the user's installed library with optional custom name & home pinning
 */
export function addCustomVideoWallpaper(path, customName = null, pinToHome = true) {
  if (!path) return null
  const filename = path.split('\\').pop().split('/').pop()
  const cleanName = filename.replace(/\.[^/.]+$/, '') // remove extension for title

  const item = {
    id: 'local-' + Date.now(),
    type: 'wallpaper',
    name: customName?.trim() || cleanName || filename,
    engine: 'video-player',
    config: { videoPath: path, speedMultiplier: 1 },
    tags: ['custom', 'video'],
    installedAt: new Date().toISOString(),
    isCustom: true,
  }

  const state = useStore.getState()
  state.installItem(item)
  if (pinToHome) {
    state.pinToHome(item.id)
  }
  return item
}
