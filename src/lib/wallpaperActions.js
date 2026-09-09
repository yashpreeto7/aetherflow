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
  const fps = options.fps ?? state.fps ?? 60

  try {
    const resolvedEngine = wallpaper.engine
      || (wallpaper.config?.videoPath ? 'video-player' : null)
      || (wallpaper.config?.imagePath ? 'image-player' : null)
      || (wallpaper.config?.streamUrl ? 'web-stream' : null)
      || wallpaper.id

    await tauriInvoke('apply_wallpaper', {
      engineId: resolvedEngine,
      config: {
        ...(wallpaper.config || {}),
        speedMultiplier: speed,
        volume,
        muted,
        fps,
      },
      opacity,
      brightness,
      monitorLabel: targetLabel || null,
    })

    // Update Zustand state
    state.setCurrentDesktopWallpaper(wallpaper)
    state.setWallpaperRunning(true)
    if (targetLabel) {
      state.setMonitorWallpaper(targetLabel, wallpaper)
    } else {
      // In duplicate mode, clear individual monitor overrides so all screens share currentDesktopWallpaper
      state.clearMonitorWallpapers()
      state.setCurrentDesktopWallpaper(wallpaper)
      state.setWallpaperRunning(true)
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
      // If no other monitors have an active wallpaper, mark running as false
      const remaining = Object.values(state.monitorWallpapers || {}).filter(Boolean)
      if (remaining.length === 0) {
        state.setWallpaperRunning(false)
        state.setCurrentDesktopWallpaper(null)
      }
    } else {
      state.clearMonitorWallpapers()
      state.setWallpaperRunning(false)
      state.setCurrentDesktopWallpaper(null)
    }
    return true
  } catch (err) {
    console.error('[AuraOS] Failed to stop wallpaper:', err)
    return false
  }
}

/**
/**
 * Sets the native Windows desktop wallpaper (Explorer wallpaper)
 */
export async function setSystemWallpaper(path) {
  if (!path) return false
  try {
    await tauriInvoke('set_system_wallpaper', { path })
    return true
  } catch (err) {
    console.error('[AetherFlow] Failed to set system wallpaper:', err)
    return false
  }
}

/**
 * Opens native file dialog to import a video or picture wallpaper and adds it to Library
 */
export async function importWallpaperDialog() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'All Supported Media',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv']
        },
        {
          name: 'Pictures (*.png, *.jpg, *.jpeg, *.webp, *.bmp)',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp']
        },
        {
          name: 'Videos (*.mp4, *.webm, *.mkv, *.avi, *.mov)',
          extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv']
        }
      ]
    })

    if (selected) {
      const path = typeof selected === 'string' ? selected : selected[0]
      if (!path) return null

      return addCustomMediaWallpaper(path)
    }
  } catch (err) {
    console.error('[AetherFlow] Failed to open import dialog:', err)
  }
  return null
}

/**
 * Adds a media file path (picture or video) into the user's installed library with optional custom name & home pinning
 */
export function addCustomMediaWallpaper(path, customName = null, pinToHome = true) {
  if (!path) return null
  const filename = path.split('\\').pop().split('/').pop()
  const cleanName = filename.replace(/\.[^/.]+$/, '') // remove extension for title

  const isImg = /\.(png|jpe?g|webp|bmp|gif|avif)$/i.test(path)

  const item = isImg ? {
    id: 'local-' + Date.now(),
    type: 'wallpaper',
    name: customName?.trim() || cleanName || filename,
    engine: 'image-player',
    config: { imagePath: path, fit: 'cover' },
    tags: ['custom', 'picture', 'image'],
    installedAt: new Date().toISOString(),
    isCustom: true,
    mediaType: 'image',
  } : {
    id: 'local-' + Date.now(),
    type: 'wallpaper',
    name: customName?.trim() || cleanName || filename,
    engine: 'video-player',
    config: { videoPath: path, speedMultiplier: 1 },
    tags: ['custom', 'video'],
    installedAt: new Date().toISOString(),
    isCustom: true,
    mediaType: 'video',
  }

  const state = useStore.getState()
  state.installItem(item)
  if (pinToHome) {
    state.pinToHome(item.id)
  }
  return item
}

// Backward compatibility alias
export const addCustomVideoWallpaper = addCustomMediaWallpaper

/**
 * Adds a live stream or YouTube URL into the user's library
 */
export function addCustomStreamWallpaper(url, customName = null, muted = true, pinToHome = true) {
  if (!url) return null
  const cleanUrl = url.trim()

  // Extract YouTube ID if present
  let ytId = null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ]
  for (const p of patterns) {
    const m = cleanUrl.match(p)
    if (m && m[1]) {
      ytId = m[1]
      break
    }
  }

  const defaultName = ytId ? 'YouTube Ambient Stream' : 'Live Web Stream'
  const preview = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '/previews/deep-space.svg'

  const item = {
    id: 'stream-' + Date.now(),
    type: 'wallpaper',
    name: customName?.trim() || defaultName,
    engine: 'web-stream',
    config: {
      streamUrl: cleanUrl,
      muted,
      youtubeId: ytId,
    },
    preview,
    tags: ytId ? ['custom', 'stream', 'youtube', 'live'] : ['custom', 'stream', 'web', 'live'],
    installedAt: new Date().toISOString(),
    isCustom: true,
    mediaType: 'stream',
  }

  const state = useStore.getState()
  state.installItem(item)
  if (pinToHome) {
    state.pinToHome(item.id)
  }
  return item
}
