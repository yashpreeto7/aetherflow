import React, { useState, useEffect } from 'react'
import { Trash2, Play, Image, Plus, Video, Monitor, Square, Check, Zap } from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { useStore } from '../store/useStore.js'
import { BUILTIN_THEMES } from '../engines/index.js'
import WallpaperPlayer from '../components/WallpaperPlayer/index.jsx'
import {
  applyWallpaperToDesktop,
  stopDesktopWallpaper,
  importWallpaperDialog,
  addCustomVideoWallpaper,
  tauriInvoke,
} from '../lib/wallpaperActions.js'

export default function LibraryPage() {
  const installed            = useStore(s => s.installed)
  const activeWallpaper      = useStore(s => s.activeWallpaper)
  const isWallpaperRunning   = useStore(s => s.isWallpaperRunning)
  const activeTheme          = useStore(s => s.activeTheme)
  const setActiveTheme       = useStore(s => s.setActiveTheme)
  const uninstallItem        = useStore(s => s.uninstallItem)
  const screenArrangement    = useStore(s => s.screenArrangement)
  const monitorWallpapers    = useStore(s => s.monitorWallpapers)

  const [monitors, setMonitors] = useState([])
  const [selectedMonitorLabel, setSelectedMonitorLabel] = useState(null)
  const [applyingId, setApplyingId] = useState(null)

  // Fetch monitors on mount
  useEffect(() => {
    tauriInvoke('get_monitors').then(res => {
      if (res && res.length > 0) {
        res.sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1
          if (!a.isPrimary && b.isPrimary) return 1
          return a.x - b.x
        })
        setMonitors(res)
        if (!selectedMonitorLabel) {
          setSelectedMonitorLabel(res[0].label)
        }
      }
    })
  }, [])

  // ── Import from file dialog ───────────────────────────────────────────────
  const handleImport = async () => {
    const newItem = await importWallpaperDialog()
    if (newItem) {
      // Auto-apply or select imported wallpaper
      await handleApply(newItem)
    }
  }

  // ── Drag & Drop to Import ────────────────────────────────────────────────
  useEffect(() => {
    let unlistenFn
    listen('tauri://drag-drop', event => {
      const payload = event.payload
      const paths = payload?.paths
      if (!paths || paths.length === 0) return

      const path = paths[0]
      const ext = path.split('.').pop().toLowerCase()
      if (['mp4', 'webm', 'ogg', 'mkv', 'avi', 'mov'].includes(ext)) {
        const item = addCustomVideoWallpaper(path)
        if (item) {
          handleApply(item)
        }
      }
    }).then(unlisten => {
      unlistenFn = unlisten
    }).catch(err => {
      console.error('Failed to listen for drag-drop', err)
    })

    return () => {
      if (unlistenFn) unlistenFn()
    }
  }, [screenArrangement, selectedMonitorLabel])

  // ── Apply to Desktop directly ────────────────────────────────────────────
  async function handleApply(item, targetMon = null) {
    setApplyingId(item.id)
    try {
      const mon = targetMon ?? (screenArrangement === 'per-screen' ? selectedMonitorLabel : null)
      await applyWallpaperToDesktop(item, { targetMonitor: mon })
    } finally {
      setApplyingId(null)
    }
  }

  // ── Stop Desktop Wallpaper ───────────────────────────────────────────────
  async function handleStop(targetMon = null) {
    const mon = targetMon ?? (screenArrangement === 'per-screen' ? selectedMonitorLabel : null)
    await stopDesktopWallpaper(mon)
  }

  // Check if wallpaper is currently active on desktop
  function getActiveStatus(item) {
    if (!isWallpaperRunning) return null
    if (screenArrangement === 'per-screen') {
      const activeScreens = Object.entries(monitorWallpapers || {})
        .filter(([_, wp]) => wp?.id === item.id)
        .map(([monLabel]) => monLabel)
      return activeScreens.length > 0 ? activeScreens : null
    }
    return activeWallpaper?.id === item.id ? ['all'] : null
  }

  const installedWallpapers = installed.filter(i => i.type !== 'theme')
  const installedThemes     = installed.filter(i => i.type === 'theme')

  const allThemes = [
    ...BUILTIN_THEMES.map(t => ({ ...t, type: 'theme', builtin: true })),
    ...installedThemes,
  ]

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ letterSpacing: '-0.5px' }}>My Library</h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Manage and directly apply your installed live wallpapers & themes
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleImport}>
          <Plus size={15} /> Add Video Wallpaper
        </button>
      </div>

      {/* Per-screen monitor selector if multiple monitors exist */}
      {screenArrangement === 'per-screen' && monitors.length > 1 && (
        <div className="card p-3" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-brand" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Target Screen:</span>
          </div>
          <div className="flex gap-2">
            {monitors.map((m, i) => {
              const isSelected = selectedMonitorLabel === m.label
              const monWp = monitorWallpapers?.[m.label]
              return (
                <button
                  key={m.label}
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '4px 12px', fontSize: 12, height: 'auto' }}
                  onClick={() => setSelectedMonitorLabel(m.label)}
                >
                  Screen {i + 1} {monWp ? `(${monWp.name})` : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Wallpapers Section */}
      <div className="flex justify-between items-center" style={{ marginBottom: 14 }}>
        <h2 className="font-semibold text-sm text-muted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          Wallpapers ({installedWallpapers.length})
        </h2>
        <span className="text-xs text-muted">Tip: Double-click any wallpaper to apply immediately to desktop</span>
      </div>

      {installedWallpapers.length === 0 ? (
        <div
          className="card card-interactive"
          style={{
            padding: 48,
            textAlign: 'center',
            color: 'var(--text-subtle)',
            marginBottom: 36,
            border: '1.5px dashed var(--border-main)',
            background: 'transparent',
          }}
          onClick={handleImport}
        >
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'color-mix(in srgb, var(--color-brand) 15%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <Video size={24} className="text-brand" />
          </div>
          <div className="text-base font-semibold" style={{ color: 'var(--text-main)', marginBottom: 4 }}>
            No custom wallpapers yet
          </div>
          <div className="text-xs text-muted" style={{ maxWidth: 360, margin: '0 auto 16px' }}>
            Click here or drag & drop any MP4, WebM, or MKV video file to install it as a live desktop wallpaper.
          </div>
          <button className="btn btn-primary" style={{ margin: '0 auto' }}>
            <Plus size={14} /> Browse Video File
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 36 }}>
          {installedWallpapers.map(item => {
            const activeStatus = getActiveStatus(item)
            const isLive = Boolean(activeStatus)
            const isApplying = applyingId === item.id

            return (
              <div
                key={item.id}
                className={`card wp-card ${isLive ? 'card-active' : ''}`}
                onDoubleClick={() => handleApply(item)}
              >
                {/* Thumbnail Preview */}
                <div style={{ height: 118, position: 'relative', background: '#000' }}>
                  <WallpaperPlayer engineId={item.engine} config={item.config ?? {}} preview />

                  {/* Active Indicator Badge */}
                  {isLive && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(16, 185, 129, 0.9)',
                      backdropFilter: 'blur(4px)',
                      borderRadius: 999,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}>
                      <div className="status-dot-live" />
                      {activeStatus[0] === 'all' ? 'LIVE ON DESKTOP' : `LIVE (${activeStatus.length} SCREEN)`}
                    </div>
                  )}

                  {/* Hover Overlay with Quick Actions */}
                  <div className="wp-hover-overlay">
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}
                      onClick={(e) => { e.stopPropagation(); handleApply(item) }}
                      disabled={isApplying}
                    >
                      <Play size={12} fill="#fff" />
                      {isApplying ? 'Applying…' : isLive ? 'Re-apply' : 'Apply to Desktop'}
                    </button>
                    {isLive && (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(239,68,68,0.2)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.4)' }}
                        onClick={(e) => { e.stopPropagation(); handleStop() }}
                      >
                        <Square size={10} fill="#fca5a5" /> Stop
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Footer Info */}
                <div style={{ padding: '10px 12px' }}>
                  <div className="font-medium text-sm truncate" title={item.name}>{item.name}</div>
                  <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                    <button
                      className={`btn ${isLive ? 'btn-ghost' : 'btn-primary'}`}
                      style={{ flex: 1, padding: '5px 8px', fontSize: 12, justifyContent: 'center' }}
                      onClick={() => handleApply(item)}
                      disabled={isApplying}
                    >
                      {isLive ? <Check size={12} className="text-brand" /> : <Play size={12} />}
                      {isApplying ? 'Applying…' : isLive ? 'Applied' : 'Apply to Desktop'}
                    </button>
                    <button
                      className="btn-icon"
                      style={{ marginLeft: 6 }}
                      title="Uninstall from Library"
                      onClick={() => {
                        if (isLive) handleStop()
                        uninstallItem(item.id)
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Themes Section */}
      <h2 className="font-semibold text-sm text-muted" style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        Themes ({allThemes.length})
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, paddingBottom: 24 }}>
        {allThemes.map(theme => {
          const isActive = activeTheme === theme.id
          return (
            <div
              key={theme.id}
              className={`card card-interactive ${isActive ? 'card-active' : ''}`}
              style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
              onClick={() => setActiveTheme(theme.id)}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: theme.bg,
                border: `2px solid ${theme.accent}`,
                boxShadow: isActive ? `0 0 10px ${theme.accent}66` : 'none',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-sm font-medium truncate">{theme.name}</div>
                <div className="text-xs text-muted">{theme.builtin ? 'Built-in' : 'Installed'} · {theme.category}</div>
              </div>
              {!theme.builtin && (
                <button className="btn-icon" onClick={e => { e.stopPropagation(); uninstallItem(theme.id) }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
