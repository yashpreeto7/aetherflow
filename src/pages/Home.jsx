import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play, Zap, MonitorPlay, Square, Monitor, Plus, Search,
  Video, Trash2, Check, Sparkles, Filter, X, Pin, PinOff, Pencil, ArrowRight
} from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { useStore } from '../store/useStore.js'
import { WALLPAPER_LIST, BUILTIN_THEMES } from '../engines/index.js'
import WallpaperPlayer from '../components/WallpaperPlayer/index.jsx'
import WallpaperThumbnail from '../components/WallpaperThumbnail/index.jsx'
import ThemeEditor from '../components/ThemeEditor/index.jsx'
import { AddWallpaperModal, RenameWallpaperModal } from '../components/Modals/WallpaperModals.jsx'
import {
  applyWallpaperToDesktop,
  stopDesktopWallpaper,
  addCustomVideoWallpaper,
  tauriInvoke,
} from '../lib/wallpaperActions.js'

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

  const activeWallpaper       = useStore(s => s.activeWallpaper)
  const setActiveWallpaper    = useStore(s => s.setActiveWallpaper)
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

  const screenArrangement     = useStore(s => s.screenArrangement)
  const monitorWallpapers     = useStore(s => s.monitorWallpapers)

  const [monitors, setMonitors] = useState([])
  const [selectedMonitorLabel, setSelectedMonitorLabel] = useState(null)

  useEffect(() => {
    tauriInvoke('get_monitors')
      .then(res => {
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
      .catch(e => console.error('Failed to fetch monitors', e))
  }, [])

  // ── Import file handler with naming modal ──────────────────────────────────
  const handleOpenImportDialog = async () => {
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
    listen('tauri://drag-drop', event => {
      const paths = event.payload?.paths
      if (!paths || paths.length === 0) return

      const path = paths[0]
      const ext = path.split('.').pop().toLowerCase()
      if (['mp4', 'webm', 'ogg', 'mkv', 'avi', 'mov'].includes(ext)) {
        const filename = path.split('\\').pop().split('/').pop()
        const cleanName = filename.replace(/\.[^/.]+$/, '')
        setAddModal({ isOpen: true, path, initialName: cleanName })
      }
    }).then(u => { unlistenFn = u }).catch(e => console.error(e))

    return () => { if (unlistenFn) unlistenFn() }
  }, [])

  function handleConfirmAdd({ name, pinToHome }) {
    if (!addModal.path) return
    const newItem = addCustomVideoWallpaper(addModal.path, name, pinToHome)
    setAddModal({ isOpen: false, path: '', initialName: '' })
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
    const builtins = WALLPAPER_LIST.map(w => ({
      id: w.id,
      name: customNames[w.id] || w.name,
      engine: w.id,
      tags: w.tags || ['canvas'],
      config: w.defaultConfig || {},
      isCustom: false,
      builtin: true,
    }))

    const customs = installed
      .filter(item => item.type === 'wallpaper')
      .map(item => ({
        id: item.id,
        name: customNames[item.id] || item.name,
        engine: item.engine || 'video-player',
        tags: item.tags || ['custom', 'video'],
        config: item.config || {},
        isCustom: true,
        installedAt: item.installedAt,
      }))

    const all = [...customs, ...builtins]
    // Filter to ONLY wallpapers pinned to Home
    return all.filter(w => homeWallpaperIds.includes(w.id))
  }, [installed, homeWallpaperIds, customNames])

  const filteredWallpapers = useMemo(() => {
    return homeWallpapers.filter(w => {
      if (filterCategory === 'builtin' && w.isCustom) return false
      if (filterCategory === 'custom' && !w.isCustom) return false
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
  }

  // ── Apply to desktop ─────────────────────────────────────────────────────
  async function handleApply(targetWp = null) {
    const wp = targetWp || activeWallpaper
    if (!wp) return

    setApplying(true)
    try {
      const mon = screenArrangement === 'per-screen' ? selectedMonitorLabel : null
      await applyWallpaperToDesktop(wp, {
        targetMonitor: mon,
        speed: wallpaperSpeed,
        volume: audioVolume,
        muted: audioMuted,
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
    if (!isWallpaperRunning) return []
    if (screenArrangement === 'per-screen') {
      return Object.entries(monitorWallpapers || {})
        .filter(([_, current]) => current?.id === wp.id)
        .map(([label]) => label)
    }
    return activeWallpaper?.id === wp.id ? ['All Screens'] : []
  }

  // ── Sliders live update ──────────────────────────────────────────────────
  async function handleBrightness(v) {
    setWallpaperBrightness(v)
    if (isWallpaperRunning) {
      await tauriInvoke('set_wallpaper_brightness', { brightness: v })
    }
  }

  async function handleOpacity(v) {
    setWallpaperOpacity(v)
    if (isWallpaperRunning) {
      await tauriInvoke('set_wallpaper_opacity', { opacity: v })
    }
  }

  async function handleSpeed(v) {
    setWallpaperSpeed(v)
    if (isWallpaperRunning && activeWallpaper) {
      await tauriInvoke('update_wallpaper_config', {
        config: { ...activeWallpaper.config, speedMultiplier: v }
      })
    }
  }

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Top Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ letterSpacing: '-0.5px' }}>
            Welcome to <span className="text-brand">AuraOS</span>
          </h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Your curated desktop dashboard — pick or double-click any favorite wallpaper below
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={handleOpenImportDialog}>
            <Plus size={15} /> Add Wallpaper
          </button>
        </div>
      </div>

      {/* Hero Preview Panel for Selected / Active Wallpaper */}
      {activeWallpaper ? (
        <div className="card" style={{ marginBottom: 28, overflow: 'hidden', position: 'relative', height: 180 }}>
          <WallpaperPlayer
            engineId={activeWallpaper.engine || activeWallpaper.id}
            config={activeWallpaper.config}
            preview
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
            display: 'flex', alignItems: 'flex-end', padding: 18,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', gap: 12 }}>
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                  {isWallpaperRunning ? (
                    <div className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)', gap: 5 }}>
                      <div className="status-dot-live" /> LIVE ON DESKTOP
                    </div>
                  ) : (
                    <div className="badge">SELECTED PREVIEW</div>
                  )}
                  {activeWallpaper.isCustom && (
                    <div className="badge badge-brand">VIDEO WALLPAPER</div>
                  )}
                </div>
                <div className="font-bold text-lg flex items-center gap-2">
                  <span>{customNames[activeWallpaper.id] || activeWallpaper.name}</span>
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

              <div style={{ display: 'flex', gap: 8 }}>
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
                  {applying ? 'Applying…' : isWallpaperRunning ? 'Re-apply' : 'Apply to Desktop'}
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
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>Supports MP4, WebM, and MKV video files with auto-loop</div>
        </div>
      )}

      {/* Property Controls (Opacity / Brightness / Speed) */}
      {activeWallpaper && (
        <div className="card p-4" style={{ marginBottom: 28 }}>
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
            {[
              { label: 'Opacity',    value: wallpaperOpacity,    set: handleOpacity,    min: 0.1, max: 1,   step: 0.05, fmt: v => `${Math.round(v * 100)}%` },
              { label: 'Brightness', value: wallpaperBrightness, set: handleBrightness, min: 0.1, max: 1.5, step: 0.05, fmt: v => `${Math.round(v * 100)}%` },
              { label: 'Speed',      value: wallpaperSpeed,      set: handleSpeed,      min: 0.1, max: 3,   step: 0.1,  fmt: v => `${parseFloat(v).toFixed(1)}×` },
            ].map(({ label, value, set, min, max, step, fmt }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 8 }}>
                  <span>{label}</span>
                  <span className="text-brand font-mono">{fmt(value)}</span>
                </div>
                <input
                  type="range"
                  className="slider"
                  min={min} max={max} step={step}
                  value={value}
                  onChange={e => set(parseFloat(e.target.value))}
                />
              </div>
            ))}
          </div>
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

        {/* Category Filters */}
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Favorites (${homeWallpapers.length})` },
            { id: 'builtin', label: `Built-in Canvas (${homeWallpapers.filter(w => !w.isCustom).length})` },
            { id: 'custom', label: `Videos & Custom (${homeWallpapers.filter(w => w.isCustom).length})` },
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 14, marginBottom: 36 }}>
          {filteredWallpapers.map(wallpaper => {
            const isSelected    = activeWallpaper?.id === wallpaper.id
            const activeScreens = getWallpaperActiveScreens(wallpaper)
            const isLive        = activeScreens.length > 0
            const engineIdToLoad = wallpaper.engine || wallpaper.id

            return (
              <div
                key={wallpaper.id}
                className={`card wp-card ${isSelected ? 'card-active' : ''}`}
                onClick={() => selectWallpaper(wallpaper)}
                onMouseEnter={() => setHoveredId(wallpaper.id)}
                onMouseLeave={() => setHoveredId(null)}
                onDoubleClick={() => {
                  selectWallpaper(wallpaper)
                  handleApply(wallpaper)
                }}
              >
                {/* Preview area */}
                <div style={{ height: 110, background: '#000', position: 'relative' }}>
                  <WallpaperThumbnail wallpaper={wallpaper} isHovered={hoveredId === wallpaper.id} />

                  {/* Badges */}
                  {isLive && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(16, 185, 129, 0.9)', backdropFilter: 'blur(4px)',
                      borderRadius: 999, padding: '2px 8px', fontSize: 9, fontWeight: 700, color: '#fff',
                      display: 'flex', alignItems: 'center', gap: 4, zIndex: 2,
                    }}>
                      <div className="status-dot-live" />
                      {activeScreens[0] === 'All Screens' ? 'LIVE' : activeScreens.join(', ')}
                    </div>
                  )}

                  {/* Quick Unpin button on card top left */}
                  <button
                    className="btn-icon"
                    style={{
                      position: 'absolute', top: 6, left: 6, zIndex: 3,
                      background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.85)',
                      padding: 4, borderRadius: 6, backdropFilter: 'blur(4px)',
                    }}
                    title="Remove from Home screen"
                    onClick={(e) => {
                      e.stopPropagation()
                      unpinFromHome(wallpaper.id)
                    }}
                  >
                    <PinOff size={11} />
                  </button>

                  {/* Hover Overlay with Wallpaper Engine quick action */}
                  <div className="wp-hover-overlay">
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        selectWallpaper(wallpaper)
                        handleApply(wallpaper)
                      }}
                    >
                      <Play size={12} fill="#fff" />
                      {isLive ? 'Re-apply' : 'Apply'}
                    </button>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Double-click to apply</span>
                  </div>
                </div>

                {/* Card Title and Tags */}
                <div style={{ padding: '10px 12px' }}>
                  <div className="flex items-center justify-between gap-1">
                    <div className="font-medium text-sm truncate" title={wallpaper.name}>
                      {wallpaper.name}
                    </div>
                    <div className="flex items-center">
                      <button
                        className="btn-icon"
                        style={{ padding: 3 }}
                        title="Rename Wallpaper"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenameModal({ isOpen: true, id: wallpaper.id, currentName: wallpaper.name })
                        }}
                      >
                        <Pencil size={11} />
                      </button>
                      {wallpaper.isCustom && (
                        <button
                          className="btn-icon"
                          style={{ padding: 3 }}
                          title="Delete custom wallpaper"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isLive) handleStop()
                            uninstallItem(wallpaper.id)
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                    {wallpaper.tags?.slice(0, 2).join(', ') || 'custom'}
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
    </div>
  )
}
