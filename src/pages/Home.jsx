import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Play, Pause, Zap, MonitorPlay, Square, Monitor, Plus, Search,
  Video, Image as ImageIcon, Trash2, Check, Sparkles, Filter, X, Pin, PinOff, Pencil, ArrowRight, Globe, Eye,
  Volume2, VolumeX
} from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { WALLPAPER_LIST, BUILTIN_THEMES } from '../engines/index.js'
import WallpaperPlayer from '../components/WallpaperPlayer/index.jsx'
import WallpaperThumbnail from '../components/WallpaperThumbnail/index.jsx'
import ThemeEditor from '../components/ThemeEditor/index.jsx'
import { AddWallpaperModal, RenameWallpaperModal, AddWebStreamModal } from '../components/Modals/WallpaperModals.jsx'
import {
  applyWallpaperToDesktop,
  stopDesktopWallpaper,
  addCustomMediaWallpaper,
  addCustomVideoWallpaper,
  addCustomStreamWallpaper,
  setSystemWallpaper,
  tauriInvoke,
  safeListen,
  safeConvertFileSrc,
} from '../lib/wallpaperActions.js'

function getWallpaperTypeInfo(wallpaper) {
  const engineId = wallpaper.engine || wallpaper.id
  const isStream = engineId === 'web-stream' || Boolean(wallpaper.config?.streamUrl)
  const isImage = engineId === 'image-player' || wallpaper.mediaType === 'image' || Boolean(wallpaper.config?.imagePath && !wallpaper.config?.videoPath)
  const isVideo = !isImage && !isStream && (wallpaper.isCustom || engineId === 'video-player' || wallpaper.mediaType === 'video')

  if (isStream) {
    const streamUrl = wallpaper.config?.streamUrl || wallpaper.config?.url || ''
    const isYt = /(?:youtu\.be\/|youtube\.com)/.test(streamUrl)
    return {
      label: isYt ? 'YouTube' : 'Stream',
      color: isYt ? 'var(--color-rose)' : 'var(--color-cyan)',
      icon: isYt ? MonitorPlay : Globe,
      type: isYt ? 'youtube' : 'stream',
    }
  }
  if (isImage) {
    return { label: 'Image', color: 'var(--color-emerald)', icon: ImageIcon, type: 'image' }
  }
  if (isVideo) {
    return { label: 'Video', color: 'var(--color-brand)', icon: Video, type: 'video' }
  }
  return { label: 'Canvas 2D', color: 'var(--color-purple)', icon: Sparkles, type: 'canvas' }
}

function getWallpaperStaticThumbnail(wallpaper) {
  if (wallpaper.preview && typeof wallpaper.preview === 'string') {
    if (wallpaper.preview.startsWith('http') || wallpaper.preview.startsWith('/') || wallpaper.preview.startsWith('data:')) {
      return wallpaper.preview
    }
    return safeConvertFileSrc(wallpaper.preview)
  }

  const engineId = wallpaper.engine || wallpaper.id
  const builtinPreviews = {
    'matrix-rain': '/previews/matrix-rain.svg',
    'cyber-particles': '/previews/cyber-particles.svg',
    'synthwave-grid': '/previews/synthwave-grid.svg',
    'deep-space': '/previews/deep-space.svg',
    'aurora': '/previews/aurora.svg',
    'tokyo-rain': '/previews/tokyo-rain.svg',
    'audio-spectrum': '/previews/audio-spectrum.svg',
  }
  if (builtinPreviews[engineId]) {
    return builtinPreviews[engineId]
  }

  const streamUrl = wallpaper.config?.streamUrl || wallpaper.config?.url
  if (streamUrl) {
    const ytMatch = streamUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)
    if (ytMatch && ytMatch[1]) {
      return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
    }
  }

  const imgPath = wallpaper.config?.imagePath || wallpaper.defaultConfig?.imagePath
  if (imgPath) {
    return imgPath.startsWith('http') || imgPath.startsWith('data:') ? imgPath : safeConvertFileSrc(imgPath)
  }

  return null
}

/**
 * CleanHomeVideoPreview — Hardware-accelerated, zero-leak video preview.
 * Completely cleans up decoders and textures upon unmount.
 */
function CleanHomeVideoPreview({ videoSrc }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const v = videoRef.current
    return () => {
      if (v) {
        try {
          v.pause()
          v.removeAttribute('src')
          v.load()
        } catch (e) {}
      }
    }
  }, [videoSrc])

  return (
    <video
      ref={videoRef}
      src={videoSrc}
      autoPlay
      loop
      muted
      controls
      playsInline
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}

/**
 * CleanHomeYouTubePreview — Zero-leak YouTube IFrame preview with about:blank navigation teardown.
 */
function CleanHomeYouTubePreview({ ytId, title }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !ytId) return

    const iframe = document.createElement('iframe')
    iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=1&loop=1&playlist=${ytId}&playsinline=1&rel=0`
    iframe.title = title || 'YouTube Preview'
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
    iframe.allowFullscreen = true
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.style.display = 'block'

    container.appendChild(iframe)

    return () => {
      try {
        iframe.src = 'about:blank'
      } catch {}
      if (container.contains(iframe)) {
        container.removeChild(iframe)
      }
    }
  }, [ytId, title])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  )
}

/**
 * Full Live Preview Modal for Home Page Wallpapers (Canvas 2D, Video, Image, Stream)
 */
function HomePreviewModal({ wallpaper, onClose, onApply, isLive }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      // Reclaim any GPU textures & memory immediately upon modal close
      tauriInvoke('trim_memory').catch(() => {})
    }
  }, [onClose])

  if (!wallpaper) return null

  const typeInfo = getWallpaperTypeInfo(wallpaper)
  const isVideo = typeInfo.type === 'video'
  const isImage = typeInfo.type === 'image'
  const isStream = typeInfo.type === 'stream' || typeInfo.type === 'youtube'

  const videoPath = wallpaper.config?.videoPath || wallpaper.defaultConfig?.videoPath
  const videoSrc = videoPath ? (videoPath.startsWith('http') || videoPath.startsWith('data:') ? videoPath : safeConvertFileSrc(videoPath)) : ''

  const imgPath = wallpaper.config?.imagePath || wallpaper.defaultConfig?.imagePath
  const imgSrc = imgPath ? (imgPath.startsWith('http') || imgPath.startsWith('data:') ? imgPath : safeConvertFileSrc(imgPath)) : (wallpaper.preview || '')

  const streamUrl = wallpaper.config?.streamUrl || wallpaper.config?.url || ''
  const ytMatch = streamUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)
  const ytId = ytMatch ? ytMatch[1] : null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        animation: 'fadeIn 0.18s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-main)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header with clean 14px gap */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-main)',
            background: 'rgba(var(--rgb-card), 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(0,0,0,0.6)',
                color: typeInfo.color || 'var(--text-main)',
                border: '1px solid rgba(255,255,255,0.12)',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <typeInfo.icon size={12} />
              <span>{typeInfo.label}</span>
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                className="font-semibold text-base"
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 460,
                  color: 'var(--text-main)',
                }}
                title={wallpaper.name}
              >
                {wallpaper.name}
              </div>
              <div className="text-xs text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                {wallpaper.communityMeta?.author
                  ? `by ${wallpaper.communityMeta.author}`
                  : wallpaper.isCustom
                  ? `Custom ${typeInfo.label}`
                  : `Built-in Canvas 2D Engine`}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-main)',
              borderRadius: 8,
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 12,
            }}
            title="Close preview (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body: Active Wallpaper Preview */}
        <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
          <div
            style={{
              width: '100%',
              aspectRatio: '16/9',
              maxHeight: '52vh',
              background: '#050505',
              borderRadius: 8,
              overflow: 'hidden',
              position: 'relative',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            {isVideo && videoSrc ? (
              <CleanHomeVideoPreview videoSrc={videoSrc} />
            ) : isImage && imgSrc ? (
              <img
                src={imgSrc}
                alt={wallpaper.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : isStream && ytId ? (
              <CleanHomeYouTubePreview ytId={ytId} title={wallpaper.name} />
            ) : (
              <WallpaperPlayer
                engineId={wallpaper.engine || wallpaper.id}
                config={wallpaper.config}
                preview
              />
            )}
          </div>

          {wallpaper.tags && wallpaper.tags.length > 0 && (
            <div className="flex gap-1.5" style={{ flexWrap: 'wrap', marginTop: 14 }}>
              {wallpaper.tags.map(t => (
                <span
                  key={t}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-main)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-main)',
            background: 'rgba(var(--rgb-card), 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            className="btn btn-ghost"
            style={{ padding: '7px 14px', fontSize: 12 }}
            onClick={onClose}
          >
            Close
          </button>
          {isLive ? (
            <span
              className="btn btn-success"
              style={{ padding: '7px 16px', fontSize: 12, cursor: 'default', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Check size={13} /> Active on Desktop
            </span>
          ) : (
            <button
              className="btn btn-primary"
              style={{ padding: '7px 18px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => onApply(wallpaper)}
            >
              <Play size={13} fill="currentColor" /> Apply to Desktop
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}


export default function HomePage() {
  const navigate = useNavigate()
  const [showThemeEditor, setShowThemeEditor] = useState(false)
  const [applying, setApplying]               = useState(false)
  const [searchQuery, setSearchQuery]         = useState('')
  const [filterCategory, setFilterCategory]   = useState('all') // 'all' | 'builtin' | 'custom'
  const [hoveredId, setHoveredId]             = useState(null)

  // Modals state
  const [addModal, setAddModal] = useState({ isOpen: false, path: '', initialName: '' })
  const [renameModal, setRenameModal] = useState({ isOpen: false, id: null, currentName: '' })
  const [addStreamModal, setAddStreamModal] = useState(false)
  const [winWallpaperSet, setWinWallpaperSet] = useState(false)
  const [previewWallpaper, setPreviewWallpaper] = useState(null)

  const activeWallpaper       = useStore(s => s.activeWallpaper)
  const setActiveWallpaper    = useStore(s => s.setActiveWallpaper)
  const currentDesktopWallpaper = useStore(s => s.currentDesktopWallpaper)
  const isWallpaperRunning    = useStore(s => s.isWallpaperRunning)
  const activeTheme           = useStore(s => s.activeTheme)
  const setActiveTheme        = useStore(s => s.setActiveTheme)
  const customThemes          = useStore(s => s.themes)
  const installed             = useStore(s => s.installed)
  const uninstallItem         = useStore(s => s.uninstallItem)
  const homeWallpaperIds      = useStore(s => s.homeWallpaperIds) || []
  const unpinFromHome         = useStore(s => s.unpinFromHome)
  const customNames           = useStore(s => s.customNames) || {}
  const setWallpaperName      = useStore(s => s.setWallpaperName)

  const wallpaperOpacity      = useStore(s => s.wallpaperOpacity)
  const setWallpaperOpacity   = useStore(s => s.setWallpaperOpacity)
  const wallpaperBrightness   = useStore(s => s.wallpaperBrightness)
  const setWallpaperBrightness = useStore(s => s.setWallpaperBrightness)
  const wallpaperSpeed        = useStore(s => s.wallpaperSpeed)
  const setWallpaperSpeed     = useStore(s => s.setWallpaperSpeed)

  const audioVolume           = useStore(s => s.audioVolume)
  const audioMuted            = useStore(s => s.audioMuted)
  const thumbnailMode         = useStore(s => s.thumbnailMode) || 'hover'
  const setThumbnailMode      = useStore(s => s.setThumbnailMode)
  const wallpaperAudioSettings = useStore(s => s.wallpaperAudioSettings) || {}
  const setWallpaperAudio     = useStore(s => s.setWallpaperAudio)

  const screenArrangement     = useStore(s => s.screenArrangement)
  const monitorWallpapers     = useStore(s => s.monitorWallpapers)

  const [monitors, setMonitors] = useState([])
  const [selectedMonitorLabel, setSelectedMonitorLabel] = useState(null)
  const [isTopPreviewPaused, setIsTopPreviewPaused] = useState(false)
  const volumeIpcTimerRef = useRef(null)

  useEffect(() => {
    let unlistenMonitors
    function loadMonitors() {
      tauriInvoke('get_monitors')
        .then(res => {
          if (res && res.length > 0) {
            res.sort((a, b) => {
              if (a.isPrimary && !b.isPrimary) return -1
              if (!a.isPrimary && b.isPrimary) return 1
              return a.x - b.x
            })
            setMonitors(res)
            setSelectedMonitorLabel(prev => {
              if (prev && res.some(m => m.label === prev)) return prev
              return res[0].label
            })
          }
        })
        .catch(e => console.error('Failed to fetch monitors', e))
    }
    loadMonitors()

    safeListen('aura:monitors-changed', () => {
      loadMonitors()
    }).then(u => { unlistenMonitors = u }).catch(() => {})

    window.addEventListener('focus', loadMonitors)
    return () => {
      if (unlistenMonitors) unlistenMonitors()
      window.removeEventListener('focus', loadMonitors)
    }
  }, [])

  // ── Import file handler with naming modal ──────────────────────────────────
  const handleOpenImportDialog = async () => {
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
        if (!path) return
        const filename = path.split('\\').pop().split('/').pop()
        const cleanName = filename.replace(/\.[^/.]+$/, '')
        setAddModal({ isOpen: true, path, initialName: cleanName })
      }
    } catch (err) {
      console.error('Failed to open import dialog:', err)
    }
  }

  // ── Drag & Drop listener ───────────────────────────────────────────────────
  useEffect(() => {
    let unlistenFn
    safeListen('tauri://drag-drop', event => {
      const paths = event.payload?.paths
      if (!paths || paths.length === 0) return

      const path = paths[0]
      const ext = path.split('.').pop().toLowerCase()
      if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'mp4', 'webm', 'ogg', 'mkv', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) {
        const filename = path.split('\\').pop().split('/').pop()
        const cleanName = filename.replace(/\.[^/.]+$/, '')
        setAddModal({ isOpen: true, path, initialName: cleanName })
      }
    }).then(u => { unlistenFn = u }).catch(e => console.error(e))

    return () => { if (unlistenFn) unlistenFn() }
  }, [])

  function handleConfirmAdd({ name, pinToHome }) {
    if (!addModal.path) return
    const newItem = addCustomMediaWallpaper(addModal.path, name, pinToHome)
    setAddModal({ isOpen: false, path: '', initialName: '' })
    if (newItem) {
      selectWallpaper(newItem)
      handleApply(newItem)
    }
  }

  function handleConfirmAddStream({ name, url, muted, pinToHome }) {
    const newItem = addCustomStreamWallpaper(url, name, muted, pinToHome)
    setAddStreamModal(false)
    if (newItem) {
      selectWallpaper(newItem)
      handleApply(newItem)
    }
  }

  function handleConfirmRename(newName) {
    if (!renameModal.id) return
    setWallpaperName(renameModal.id, newName)
    setRenameModal({ isOpen: false, id: null, currentName: '' })
  }

  function handleSelectMonitor(label) {
    setSelectedMonitorLabel(label)
    if (monitorWallpapers && monitorWallpapers[label]) {
      setActiveWallpaper(monitorWallpapers[label])
    }
  }

  // ── Curated Home Wallpapers List ───────────────────────────────────────────
  // Combine all items, but display ONLY those where homeWallpaperIds.includes(w.id)
  const homeWallpapers = useMemo(() => {
    const names = customNames || {}
    const builtins = WALLPAPER_LIST.map(w => ({
      id: w.id,
      name: names[w.id] || w.name,
      engine: w.id,
      tags: w.tags || ['canvas'],
      config: w.defaultConfig || {},
      isCustom: false,
      builtin: true,
    }))

    const customs = (installed || [])
      .filter(item => item && item.type === 'wallpaper')
      .map(item => ({
        ...item,
        id: item.id,
        name: names[item.id] || item.name,
        engine: item.engine || 'video-player',
        tags: item.tags || ['custom', 'video'],
        config: item.config || {},
        isCustom: true,
        installedAt: item.installedAt,
      }))

    const all = [...customs, ...builtins]
    const homeIds = homeWallpaperIds || []
    // Filter to ONLY wallpapers pinned to Home (or all builtins if not yet initialized)
    if (homeIds.length === 0) return builtins
    return all.filter(w => homeIds.includes(w.id))
  }, [installed, homeWallpaperIds, customNames])

  const filteredWallpapers = useMemo(() => {
    return homeWallpapers.filter(w => {
      if (filterCategory === 'builtin' && w.isCustom) return false
      if (filterCategory === 'custom' && (!w.isCustom || w.config?.streamUrl)) return false
      if (filterCategory === 'stream' && !w.config?.streamUrl) return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = w.name.toLowerCase().includes(query)
        const matchTag = w.tags?.some(t => t.toLowerCase().includes(query))
        return matchName || matchTag
      }
      return true
    })
  }, [homeWallpapers, filterCategory, searchQuery])

  // ── Select a wallpaper (for previewing & tuning sliders) ───────────────────
  function selectWallpaper(wallpaper) {
    setActiveWallpaper({
      id: wallpaper.id,
      name: wallpaper.name,
      engine: wallpaper.engine || wallpaper.id,
      config: { ...(wallpaper.config || {}), speedMultiplier: wallpaperSpeed },
      isCustom: wallpaper.isCustom,
    })
    // Asynchronously request native memory trim to reclaim any dormant video decoder cache
    setTimeout(() => {
      tauriInvoke('trim_memory').catch(() => {})
    }, 400)
  }

  // ── Apply to desktop ─────────────────────────────────────────────────────
  async function handleApply(targetWp = null) {
    const wp = targetWp || activeWallpaper
    if (!wp) return

    setApplying(true)
    try {
      const mon = screenArrangement === 'per-screen' ? selectedMonitorLabel : null
      const targetAudio = wallpaperAudioSettings[wp.id] || {
        volume: wp.config?.volume ?? audioVolume ?? 50,
        muted: wp.config?.muted ?? audioMuted ?? false,
      }
      await applyWallpaperToDesktop(wp, {
        targetMonitor: mon,
        speed: wallpaperSpeed,
        volume: targetAudio.volume,
        muted: targetAudio.muted,
        opacity: wallpaperOpacity,
        brightness: wallpaperBrightness,
      })
    } finally {
      setApplying(false)
    }
  }

  // ── Stop wallpaper ───────────────────────────────────────────────────────
  async function handleStop() {
    const mon = screenArrangement === 'per-screen' ? selectedMonitorLabel : null
    await stopDesktopWallpaper(mon)
  }

  // ── Check if a wallpaper is active on any screen ──────────────────────────
  function getWallpaperActiveScreens(wp) {
    if (!isWallpaperRunning || !wp) return []
    if (screenArrangement === 'per-screen') {
      const matched = Object.entries(monitorWallpapers || {})
        .filter(([_, current]) => current?.id === wp.id)
        .map(([label]) => {
          const idx = monitors.findIndex(m => m.label === label)
          return idx >= 0 ? `Screen ${idx + 1}` : 'Screen'
        })
      return matched
    }
    return currentDesktopWallpaper?.id === wp.id ? ['All Screens'] : []
  }

  // ── Sliders live update ──────────────────────────────────────────────────
  async function handleBrightness(v) {
    setWallpaperBrightness(v)
    if (isWallpaperRunning) {
      await tauriInvoke('set_wallpaper_brightness', { brightness: v })
      await tauriInvoke('update_wallpaper_config', { config: { brightness: v } })
    }
  }

  async function handleOpacity(v) {
    setWallpaperOpacity(v)
    if (isWallpaperRunning) {
      await tauriInvoke('set_wallpaper_opacity', { opacity: v })
      await tauriInvoke('update_wallpaper_config', { config: { opacity: v } })
    }
  }

  async function handleSpeed(v) {
    setWallpaperSpeed(v)
    if (isWallpaperRunning) {
      await tauriInvoke('update_wallpaper_config', {
        config: { speedMultiplier: v, speed: v }
      })
    }
  }

  async function handleFit(fit) {
    if (!activeWallpaper) return
    const updatedConfig = { ...(activeWallpaper.config || {}), fit }
    useStore.getState().updateWallpaperConfig({ fit })
    if (isWallpaperRunning) {
      await tauriInvoke('update_wallpaper_config', {
        config: updatedConfig,
        monitorLabel: selectedMonitorLabel || null,
      })
    }
  }

  async function handleSetWindowsWallpaper() {
    const imgPath = activeWallpaper?.config?.imagePath
    if (!imgPath) return
    const ok = await setSystemWallpaper(imgPath)
    if (ok) {
      setWinWallpaperSet(true)
      setTimeout(() => setWinWallpaperSet(false), 2500)
    }
  }

  const isCurrentWallpaperImage = activeWallpaper?.engine === 'image-player' ||
    Boolean(activeWallpaper?.config?.imagePath && !activeWallpaper?.config?.videoPath)

  // ── Per-wallpaper adhered audio ───────────────────────────────────────────
  const currentWallpaperAudio = activeWallpaper
    ? (wallpaperAudioSettings[activeWallpaper.id] || {
        volume: activeWallpaper.config?.volume ?? audioVolume ?? 50,
        muted: activeWallpaper.config?.muted ?? audioMuted ?? false,
      })
    : { volume: audioVolume ?? 50, muted: audioMuted ?? false }

  async function handleWallpaperVolumeChange(vol) {
    if (!activeWallpaper) return
    const nextAudio = { ...currentWallpaperAudio, volume: vol }
    setWallpaperAudio(activeWallpaper.id, nextAudio)
    useStore.setState({ audioVolume: vol })

    // If active wallpaper is running on desktop, debounced update of native audio
    if (isWallpaperRunning) {
      clearTimeout(volumeIpcTimerRef.current)
      volumeIpcTimerRef.current = setTimeout(async () => {
        await tauriInvoke('set_mpv_volume', { monitorLabel: null, volume: vol }).catch(() => {})
        await tauriInvoke('update_wallpaper_config', {
          config: { volume: vol, muted: nextAudio.muted },
          monitorLabel: null,
        }).catch(() => {})
      }, 35)
    }
  }

  async function handleWallpaperMuteToggle() {
    if (!activeWallpaper) return
    const nextMuted = !currentWallpaperAudio.muted
    const nextAudio = { ...currentWallpaperAudio, muted: nextMuted }
    setWallpaperAudio(activeWallpaper.id, nextAudio)
    useStore.setState({ audioMuted: nextMuted })

    // If active wallpaper is running on desktop, update live native audio immediately
    if (isWallpaperRunning) {
      await tauriInvoke('set_mpv_mute', { monitorLabel: null, muted: nextMuted }).catch(() => {})
      await tauriInvoke('update_wallpaper_config', {
        config: { volume: nextAudio.volume, muted: nextMuted },
        monitorLabel: null,
      }).catch(() => {})
    }
  }

  const activeScreensForSelected = activeWallpaper ? getWallpaperActiveScreens(activeWallpaper) : []
  const selectedIsLive = activeScreensForSelected.length > 0

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Top Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ letterSpacing: '-0.5px' }}>
            Welcome to <span className="text-brand">AetherFlow</span>
          </h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Your curated desktop dashboard — pick or double-click any favorite wallpaper below
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={() => setAddStreamModal(true)}>
            <Globe size={15} /> Add Web Stream
          </button>
          <button className="btn btn-primary" onClick={handleOpenImportDialog}>
            <Plus size={15} /> Add Media
          </button>
        </div>
      </div>

      {/* Hero Preview Panel for Selected / Active Wallpaper */}
      {activeWallpaper ? (
        <div className="card" style={{ marginBottom: 28, overflow: 'hidden', position: 'relative', height: 180 }}>
          {!isTopPreviewPaused ? (
            <WallpaperPlayer
              engineId={activeWallpaper.engine || activeWallpaper.id}
              config={activeWallpaper.config}
              preview
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: '#05070d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WallpaperThumbnail
                wallpaper={activeWallpaper}
                isHovered={false}
                mode="always"
              />
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  background: 'rgba(10, 14, 24, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--border-main)',
                  borderRadius: 6,
                  padding: '3px 9px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  zIndex: 4,
                }}
              >
                <Pause size={10} />
                <span>PREVIEW PAUSED (ZERO GPU/RAM)</span>
              </div>
            </div>
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
            display: 'flex', alignItems: 'flex-end', padding: 18,
            zIndex: 10, pointerEvents: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', gap: 12 }}>
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                  {selectedIsLive ? (
                    <div className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)', gap: 5 }}>
                      <div className="status-dot-live" /> LIVE ON {activeScreensForSelected.join(', ').toUpperCase()}
                    </div>
                  ) : (
                    <div className="badge">SELECTED PREVIEW</div>
                  )}
                  {activeWallpaper.config?.streamUrl ? (
                    <div className="badge badge-brand" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                      {activeWallpaper.config?.youtubeId ? 'YOUTUBE STREAM' : 'WEB STREAM'}
                    </div>
                  ) : activeWallpaper.isCustom && (
                    <div className="badge badge-brand">VIDEO WALLPAPER</div>
                  )}
                </div>
                <div className="font-bold text-lg flex items-center gap-2">
                  <span>{(customNames || {})[activeWallpaper?.id] || activeWallpaper?.name}</span>
                  <button
                    className="btn-icon"
                    style={{ padding: 2 }}
                    title="Rename Wallpaper"
                    onClick={() => setRenameModal({ isOpen: true, id: activeWallpaper.id, currentName: activeWallpaper.name })}
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Pause / Resume Live Preview Button */}
                <button
                  className="btn btn-ghost"
                  style={{
                    height: 36,
                    padding: '4px 10px',
                    fontSize: 11.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: isTopPreviewPaused ? 'rgba(59, 130, 246, 0.2)' : 'rgba(10, 14, 22, 0.75)',
                    border: '1px solid var(--border-main)',
                    color: isTopPreviewPaused ? 'var(--color-brand)' : 'var(--text-muted)',
                  }}
                  onClick={() => {
                    setIsTopPreviewPaused(p => !p)
                    tauriInvoke('trim_memory').catch(() => {})
                  }}
                  title={isTopPreviewPaused ? "Resume live animated preview" : "Pause preview animation to save CPU & GPU memory"}
                >
                  {isTopPreviewPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
                  <span>{isTopPreviewPaused ? 'Resume Preview' : 'Pause Preview'}</span>
                </button>
                {isWallpaperRunning && (
                  <button
                    className="btn"
                    style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}
                    onClick={handleStop}
                  >
                    <Square size={13} fill="#fca5a5" style={{ marginRight: 6 }} /> Stop
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => handleApply()}
                  disabled={applying}
                  style={{ opacity: applying ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 140, justifyContent: 'center' }}
                >
                  <MonitorPlay size={15} />
                  {applying ? 'Applying…' : selectedIsLive ? 'Re-apply' : 'Apply to Desktop'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="card card-interactive"
          style={{
            marginBottom: 28, padding: 36, textAlign: 'center',
            border: '1.5px dashed var(--border-main)', background: 'transparent',
          }}
          onClick={handleOpenImportDialog}
        >
          <Plus size={28} className="text-brand" style={{ margin: '0 auto 10px', opacity: 0.8 }} />
          <div className="text-sm font-medium">Select a wallpaper below or click to import your own</div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>Supports pictures (PNG, JPG, WebP) and videos (MP4, WebM, MKV)</div>
        </div>
      )}

      {/* Property Controls (Opacity / Brightness / Speed or Fit) */}
      {activeWallpaper && (
        <div className="card p-4" style={{ marginBottom: 28, userSelect: 'none', WebkitUserSelect: 'none' }}>
          {screenArrangement === 'per-screen' && monitors.length > 1 && (
            <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-main)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted" style={{ marginBottom: 10 }}>Target Monitor</div>
              <div className="flex gap-2">
                {monitors.map((m, i) => {
                  const isSelected = selectedMonitorLabel === m.label
                  const monWp = monitorWallpapers?.[m.label]
                  return (
                    <button
                      key={m.label}
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => handleSelectMonitor(m.label)}
                      style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}
                    >
                      <Monitor size={16} />
                      <span style={{ fontSize: 11, fontWeight: 600 }}>Screen {i + 1}</span>
                      {monWp && (
                        <span style={{ fontSize: 10, opacity: 0.8, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {monWp.name}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
            <div>
              <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 8, userSelect: 'none' }}>
                <span>Opacity</span>
                <span className="text-brand font-mono">{Math.round(wallpaperOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                className="slider"
                min={0.1} max={1} step={0.05}
                value={wallpaperOpacity}
                draggable={false}
                onDragStart={e => e.preventDefault()}
                style={{ touchAction: 'none' }}
                onChange={e => handleOpacity(parseFloat(e.target.value))}
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 8, userSelect: 'none' }}>
                <span>Brightness</span>
                <span className="text-brand font-mono">{Math.round(wallpaperBrightness * 100)}%</span>
              </div>
              <input
                type="range"
                className="slider"
                min={0.1} max={1.5} step={0.05}
                value={wallpaperBrightness}
                draggable={false}
                onDragStart={e => e.preventDefault()}
                style={{ touchAction: 'none' }}
                onChange={e => handleBrightness(parseFloat(e.target.value))}
              />
            </div>

            {isCurrentWallpaperImage ? (
              <div>
                <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 8, userSelect: 'none' }}>
                  <span>Scaling / Fit</span>
                  <span className="text-brand font-mono capitalize">{activeWallpaper.config?.fit || 'cover'}</span>
                </div>
                <div className="flex gap-1">
                  {['cover', 'contain', 'stretch'].map(fit => (
                    <button
                      key={fit}
                      className={`btn ${(activeWallpaper.config?.fit || 'cover') === fit ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, padding: '5px 8px', fontSize: 11, textTransform: 'capitalize' }}
                      onClick={() => handleFit(fit)}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 8, userSelect: 'none' }}>
                  <span>Speed</span>
                  <span className="text-brand font-mono">{parseFloat(wallpaperSpeed).toFixed(1)}×</span>
                </div>
                <input
                  type="range"
                  className="slider"
                  min={0.1} max={3} step={0.1}
                  value={wallpaperSpeed}
                  draggable={false}
                  onDragStart={e => e.preventDefault()}
                  style={{ touchAction: 'none' }}
                  onChange={e => handleSpeed(parseFloat(e.target.value))}
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center text-xs text-muted" style={{ marginBottom: 8, userSelect: 'none' }}>
                <span className="flex items-center gap-1.5">
                  <button
                    className="btn-icon"
                    style={{
                      padding: 2,
                      color: currentWallpaperAudio.muted ? 'var(--color-rose)' : 'var(--color-brand)',
                    }}
                    onClick={handleWallpaperMuteToggle}
                    title={currentWallpaperAudio.muted ? "Unmute wallpaper" : "Mute wallpaper"}
                  >
                    {currentWallpaperAudio.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>
                  <span>Volume</span>
                </span>
                <span className="text-brand font-mono">
                  {currentWallpaperAudio.muted ? 'Muted' : `${currentWallpaperAudio.volume}%`}
                </span>
              </div>
              <input
                type="range"
                className="slider"
                min={0} max={100} step={1}
                value={currentWallpaperAudio.muted ? 0 : currentWallpaperAudio.volume}
                draggable={false}
                onDragStart={e => e.preventDefault()}
                style={{ touchAction: 'none' }}
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  if (currentWallpaperAudio.muted && v > 0) {
                    setWallpaperAudio(activeWallpaper.id, { volume: v, muted: false })
                    useStore.setState({ audioVolume: v, audioMuted: false })
                  } else {
                    handleWallpaperVolumeChange(v)
                  }
                }}
              />
            </div>
          </div>

          {isCurrentWallpaperImage && activeWallpaper?.config?.imagePath && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div className="text-xs text-muted">
                Also set this picture as your Windows desktop system wallpaper (persists even when app closes)
              </div>
              <button
                className={`btn ${winWallpaperSet ? 'btn-success' : 'btn-ghost'}`}
                style={{ fontSize: 12, padding: '5px 14px' }}
                onClick={handleSetWindowsWallpaper}
              >
                {winWallpaperSet ? (
                  <>
                    <Check size={13} style={{ marginRight: 4 }} /> Set as System Wallpaper!
                  </>
                ) : (
                  <>
                    <ImageIcon size={13} style={{ marginRight: 4 }} /> Set as Windows Wallpaper
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Wallpapers Section Header & Filter Bar */}
      <div style={{ marginBottom: 16 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-base">Home Favorites</h2>
            <span className="badge font-mono">{homeWallpapers.length}</span>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: '3px 10px', height: 'auto' }}
              onClick={() => navigate('/library')}
            >
              Manage in Library <ArrowRight size={11} style={{ marginLeft: 3 }} />
            </button>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search home wallpapers…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 26px 6px 30px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-main)',
                borderRadius: 8,
                color: 'var(--text-main)',
                fontSize: 12,
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                className="btn-icon"
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: 2 }}
                onClick={() => setSearchQuery('')}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filters & Thumbnail Mode Selector */}
        <div className="flex items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: `All Favorites (${homeWallpapers.length})` },
              { id: 'builtin', label: `Built-in Canvas (${homeWallpapers.filter(w => !w.isCustom).length})` },
              { id: 'custom', label: `Custom Media (${homeWallpapers.filter(w => w.isCustom && !w.config?.streamUrl).length})` },
              { id: 'stream', label: `Web Streams (${homeWallpapers.filter(w => w.config?.streamUrl).length})` },
            ].map(cat => (
              <button
                key={cat.id}
                className={`badge ${filterCategory === cat.id ? 'badge-brand' : ''}`}
                style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 11 }}
                onClick={() => setFilterCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Thumbnail / Preview Mode Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-main)',
              borderRadius: 8,
              padding: '3px 4px',
            }}
            title="Card Preview Mode: On (Always), Hover (On Mouse Hover), Off (Minimalist vector badges)"
          >
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', paddingLeft: 4, paddingRight: 3, fontWeight: 500 }}>
              Thumbnails:
            </span>
            {[
              { id: 'always', label: 'On', title: 'Always Show Thumbnails' },
              { id: 'hover', label: 'Hover', title: 'Show Previews on Hover (Low RAM)' },
              { id: 'off', label: 'Off', title: 'Off — Clean Vector Badges (Zero RAM)' },
            ].map(m => (
              <button
                key={m.id}
                className={`btn ${thumbnailMode === m.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  padding: '2px 8px',
                  fontSize: 10.5,
                  height: 22,
                  borderRadius: 5,
                  fontWeight: thumbnailMode === m.id ? 700 : 500,
                }}
                onClick={() => setThumbnailMode(m.id)}
                title={m.title}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pinned Wallpaper Grid */}
      {homeWallpapers.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-subtle)', marginBottom: 36, border: '1.5px dashed var(--border-main)', background: 'transparent' }}>
          <Pin size={28} className="text-brand" style={{ margin: '0 auto 12px', opacity: 0.7 }} />
          <div className="text-base font-semibold" style={{ color: 'var(--text-main)', marginBottom: 6 }}>
            No wallpapers pinned to Home yet
          </div>
          <p className="text-xs text-muted" style={{ maxWidth: 380, margin: '0 auto 18px' }}>
            Your Library holds all available wallpapers. Visit the Library to select which ones you want to appear on your Home dashboard.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/library')} style={{ margin: '0 auto' }}>
            Open Library to Pick Wallpapers <ArrowRight size={13} style={{ marginLeft: 4 }} />
          </button>
        </div>
      ) : filteredWallpapers.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)', marginBottom: 32 }}>
          <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          <div className="text-sm">No home wallpapers matching "{searchQuery}"</div>
          <button className="btn btn-ghost" style={{ marginTop: 12, fontSize: 12 }} onClick={() => { setSearchQuery(''); setFilterCategory('all'); }}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20, marginBottom: 36 }}>
          {filteredWallpapers.map(wallpaper => {
            const isSelected    = activeWallpaper?.id === wallpaper.id
            const activeScreens = getWallpaperActiveScreens(wallpaper)
            const isLive        = activeScreens.length > 0
            const typeInfo      = getWallpaperTypeInfo(wallpaper)
            const thumbUrl      = getWallpaperStaticThumbnail(wallpaper)
            const isVideo       = typeInfo.type === 'video'
            const videoPath     = wallpaper.config?.videoPath || wallpaper.defaultConfig?.videoPath
            const videoSrc      = videoPath ? (videoPath.startsWith('http') || videoPath.startsWith('data:') ? videoPath : safeConvertFileSrc(videoPath)) : ''

            return (
              <div
                key={wallpaper.id}
                className="mp-card"
                style={{
                  border: isSelected ? '1px solid var(--color-brand)' : undefined,
                  boxShadow: isSelected ? '0 0 0 1px var(--color-brand), 0 8px 24px rgba(0,0,0,0.4)' : undefined,
                }}
                onClick={() => selectWallpaper(wallpaper)}
                onMouseEnter={() => setHoveredId(wallpaper.id)}
                onMouseLeave={() => setHoveredId(null)}
                onDoubleClick={() => {
                  selectWallpaper(wallpaper)
                  handleApply(wallpaper)
                }}
              >
                {/* ── 1. Thumbnail Container (Supports On, Hover, and Off modes, Zero Leak) ── */}
                <div
                  className="mp-thumb-container"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPreviewWallpaper(wallpaper)
                  }}
                  title={`Click to preview ${wallpaper.name}`}
                >
                  <WallpaperThumbnail
                    wallpaper={wallpaper}
                    isHovered={hoveredId === wallpaper.id}
                    mode={thumbnailMode}
                  />

                  {/* Top-Left: Media Type Badge */}
                  <div className="mp-badge-top-left">
                    <div
                      className="mp-pill-badge"
                      style={{
                        background: 'rgba(10, 10, 14, 0.75)',
                        color: typeInfo.color,
                        border: '1px solid rgba(255,255,255,0.12)',
                        fontSize: 10,
                      }}
                    >
                      <typeInfo.icon size={11} />
                      <span>{typeInfo.label}</span>
                    </div>
                  </div>

                  {/* Top-Right: Live Status Badge & Unpin Button */}
                  <div className="mp-badge-top-right flex items-center gap-1">
                    {isLive && (
                      <div
                        className="mp-pill-badge"
                        style={{
                          background: 'rgba(16, 185, 129, 0.92)',
                          color: '#fff',
                          border: '1px solid rgba(255,255,255,0.2)',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        <div className="status-dot-live" />
                        <span>{activeScreens[0] === 'All Screens' ? 'LIVE' : activeScreens.join(', ')}</span>
                      </div>
                    )}

                    <button
                      className="btn-icon"
                      style={{
                        background: 'rgba(0,0,0,0.65)',
                        color: 'rgba(255,255,255,0.85)',
                        padding: 5,
                        borderRadius: 6,
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}
                      title="Remove from Home favorites"
                      onClick={(e) => {
                        e.stopPropagation()
                        unpinFromHome(wallpaper.id)
                      }}
                    >
                      <PinOff size={12} />
                    </button>
                  </div>

                  {/* Hover Overlay: Center Quick Preview Pill */}
                  <div className="mp-thumb-overlay">
                    <div className="mp-preview-pill">
                      <Eye size={13} />
                      <span>Quick Preview</span>
                    </div>
                  </div>
                </div>

                {/* ── 2. Card Content & Hierarchy ── */}
                <div style={{ padding: '16px 16px 14px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {/* Title & Subtitle */}
                  <div style={{ marginBottom: 10 }}>
                    <h3
                      className="font-semibold"
                      style={{
                        fontSize: 14,
                        lineHeight: '1.3',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        color: isSelected ? 'var(--color-brand)' : 'var(--text-main)',
                        transition: 'color 0.15s ease',
                      }}
                      onClick={() => selectWallpaper(wallpaper)}
                      title={wallpaper.name}
                    >
                      {wallpaper.name}
                    </h3>
                    <div className="text-xs text-muted" style={{ marginTop: 3 }}>
                      {wallpaper.communityMeta?.author
                        ? `by ${wallpaper.communityMeta.author}`
                        : wallpaper.isCustom
                        ? `Custom ${typeInfo.label}`
                        : `Built-in Canvas 2D Engine`}
                    </div>
                  </div>

                  {/* Tags & Action Icons Row */}
                  <div
                    className="flex items-center justify-between"
                    style={{
                      paddingTop: 10,
                      paddingBottom: 12,
                      borderTop: '1px solid var(--border-main)',
                      marginBottom: 12,
                    }}
                  >
                    <div className="flex items-center gap-1 text-xs text-subtle truncate" style={{ maxWidth: '55%' }}>
                      {wallpaper.tags && wallpaper.tags.length > 0 ? (
                        wallpaper.tags.slice(0, 2).map(tag => (
                          <span
                            key={tag}
                            style={{
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-main)',
                              fontSize: 10,
                            }}
                          >
                            #{tag}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>60 FPS Native</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Dedicated Preview Button */}
                      <button
                        className="btn btn-ghost"
                        style={{
                          padding: '4px 8px',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--text-muted)',
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setPreviewWallpaper(wallpaper)
                        }}
                        title="Open live preview window"
                      >
                        <Eye size={12} />
                        <span>Preview</span>
                      </button>

                      <button
                        className="btn-icon"
                        style={{ padding: '4px 6px', color: 'var(--text-muted)' }}
                        title="Rename Wallpaper"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenameModal({ isOpen: true, id: wallpaper.id, currentName: wallpaper.name })
                        }}
                      >
                        <Pencil size={12} />
                      </button>

                      {wallpaper.isCustom && (
                        <button
                          className="btn-icon"
                          style={{ padding: '4px 6px', color: 'var(--color-rose)' }}
                          title="Delete custom wallpaper"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isLive) handleStop()
                            uninstallItem(wallpaper.id)
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Primary Action Button (Full Width, 36px Height, ONLY ONE APPLY BUTTON) */}
                  <div style={{ marginTop: 'auto' }}>
                    {isLive ? (
                      <div
                        className="btn btn-success mp-btn-action w-full"
                        style={{
                          cursor: 'default',
                          background: 'color-mix(in srgb, var(--color-emerald) 15%, transparent)',
                          borderColor: 'var(--color-emerald)',
                          color: 'var(--color-emerald)',
                        }}
                      >
                        <Check size={14} /> Active on Desktop
                      </div>
                    ) : (
                      <button
                        className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'} mp-btn-action w-full`}
                        onClick={(e) => {
                          e.stopPropagation()
                          selectWallpaper(wallpaper)
                          handleApply(wallpaper)
                        }}
                        title="Apply to Windows desktop"
                      >
                        <Play size={13} fill="currentColor" /> Apply to Desktop
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Themes Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 className="font-semibold text-base">Themes</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 24 }}>
        {/* Create Theme Button */}
        <div
          className="card card-interactive"
          style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}
          onClick={() => setShowThemeEditor(true)}
        >
          <div className="text-xs font-medium text-brand">+ Create Theme</div>
        </div>

        {/* Custom Themes */}
        {Object.entries(customThemes || {}).map(([id, tokens]) => {
          const isActive = activeTheme === id
          const meta = tokens._meta || { name: 'Custom Theme', bg: '#000', accent: '#fff' }
          return (
            <div
              key={id}
              className={`card card-interactive ${isActive ? 'card-active' : ''}`}
              style={{ padding: '12px 14px', cursor: 'pointer' }}
              onClick={() => setActiveTheme(id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: meta.bg.startsWith('#') ? meta.bg : `rgb(${meta.bg})`,
                  border: `2px solid ${meta.accent}`,
                  boxShadow: `0 0 8px ${meta.accent}66`,
                }} />
                <div style={{ overflow: 'hidden' }}>
                  <div className="text-xs font-medium truncate">{meta.name}</div>
                  <div className="text-xs text-muted">Custom</div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Built-in Themes */}
        {BUILTIN_THEMES.map(theme => {
          const isActive = activeTheme === theme.id
          return (
            <div
              key={theme.id}
              className={`card card-interactive ${isActive ? 'card-active' : ''}`}
              style={{ padding: '12px 14px', cursor: 'pointer' }}
              onClick={() => setActiveTheme(theme.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: theme.bg,
                  border: `2px solid ${theme.accent}`,
                  boxShadow: `0 0 8px ${theme.accent}66`,
                }} />
                <div>
                  <div className="text-xs font-medium truncate">{theme.name.replace('Sovereign ', '')}</div>
                  <div className="text-xs text-muted">{theme.category}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showThemeEditor && <ThemeEditor onClose={() => setShowThemeEditor(false)} />}

      {/* Modals */}
      <AddWallpaperModal
        isOpen={addModal.isOpen}
        filePath={addModal.path}
        initialName={addModal.initialName}
        onClose={() => setAddModal({ isOpen: false, path: '', initialName: '' })}
        onConfirm={handleConfirmAdd}
      />

      <RenameWallpaperModal
        isOpen={renameModal.isOpen}
        currentName={renameModal.currentName}
        onClose={() => setRenameModal({ isOpen: false, id: null, currentName: '' })}
        onConfirm={handleConfirmRename}
      />

      <AddWebStreamModal
        isOpen={addStreamModal}
        onClose={() => setAddStreamModal(false)}
        onConfirm={handleConfirmAddStream}
      />

      {previewWallpaper && (
        <HomePreviewModal
          wallpaper={previewWallpaper}
          onClose={() => setPreviewWallpaper(null)}
          onApply={(wp) => {
            selectWallpaper(wp)
            handleApply(wp)
            setPreviewWallpaper(null)
          }}
          isLive={getWallpaperActiveScreens(previewWallpaper).length > 0}
        />
      )}
    </div>
  )
}
