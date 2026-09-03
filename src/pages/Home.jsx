import React, { useState, useEffect, useMemo } from 'react'
import {
  Play, Zap, MonitorPlay, Square, Monitor, Plus, Search,
  Video, Trash2, Check, Sparkles, Filter, X
} from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { useStore } from '../store/useStore.js'
import { WALLPAPER_LIST, BUILTIN_THEMES } from '../engines/index.js'
import WallpaperPlayer from '../components/WallpaperPlayer/index.jsx'
import ThemeEditor from '../components/ThemeEditor/index.jsx'
import {
  applyWallpaperToDesktop,
  stopDesktopWallpaper,
  importWallpaperDialog,
  addCustomVideoWallpaper,
  tauriInvoke,
} from '../lib/wallpaperActions.js'

export default function HomePage() {
  const [showThemeEditor, setShowThemeEditor] = useState(false)
  const [applying, setApplying]               = useState(false)
  const [searchQuery, setSearchQuery]         = useState('')
  const [filterCategory, setFilterCategory]   = useState('all') // 'all' | 'builtin' | 'custom'

  const activeWallpaper       = useStore(s => s.activeWallpaper)
  const setActiveWallpaper    = useStore(s => s.setActiveWallpaper)
  const isWallpaperRunning    = useStore(s => s.isWallpaperRunning)
  const setWallpaperRunning   = useStore(s => s.setWallpaperRunning)
  const activeTheme           = useStore(s => s.activeTheme)
  const setActiveTheme        = useStore(s => s.setActiveTheme)
  const customThemes          = useStore(s => s.themes)
  const installed             = useStore(s => s.installed)
  const uninstallItem         = useStore(s => s.uninstallItem)
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
  const setMonitorWallpaper   = useStore(s => s.setMonitorWallpaper)

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

  // ── Drag & Drop listener ───────────────────────────────────────────────────
  useEffect(() => {
    let unlistenFn
    listen('tauri://drag-drop', event => {
      const paths = event.payload?.paths
      if (!paths || paths.length === 0) return

      const path = paths[0]
      const ext = path.split('.').pop().toLowerCase()
      if (['mp4', 'webm', 'ogg', 'mkv', 'avi', 'mov'].includes(ext)) {
        const item = addCustomVideoWallpaper(path)
        if (item) {
          selectWallpaper(item)
          handleApply(item)
        }
      }
    }).then(u => { unlistenFn = u }).catch(e => console.error(e))

    return () => { if (unlistenFn) unlistenFn() }
  }, [screenArrangement, selectedMonitorLabel])

  function handleSelectMonitor(label) {
    setSelectedMonitorLabel(label)
    if (monitorWallpapers && monitorWallpapers[label]) {
      setActiveWallpaper(monitorWallpapers[label])
    }
  }

  // ── Unified Wallpapers List (Built-in + Custom/Installed) ─────────────────
  const customWallpapers = useMemo(() => {
    return installed
      .filter(item => item.type === 'wallpaper')
      .map(item => ({
        id: item.id,
        name: item.name,
        engine: item.engine,
        tags: item.tags || ['custom', 'video'],
        defaultConfig: item.config || {},
        isCustom: true,
        installedAt: item.installedAt,
      }))
  }, [installed])

  const allWallpapers = useMemo(() => {
    const builtins = WALLPAPER_LIST.map(w => ({ ...w, isCustom: false }))
    return [...customWallpapers, ...builtins]
  }, [customWallpapers])

  const filteredWallpapers = useMemo(() => {
    return allWallpapers.filter(w => {
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
  }, [allWallpapers, filterCategory, searchQuery])

  // ── Select a wallpaper (for previewing & tuning sliders) ───────────────────
  function selectWallpaper(wallpaper) {
    setActiveWallpaper({
      id: wallpaper.id,
      name: wallpaper.name,
      engine: wallpaper.engine,
      config: { ...(wallpaper.defaultConfig || wallpaper.config || {}), speedMultiplier: wallpaperSpeed },
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

  // ── Import custom wallpaper from file ────────────────────────────────────
  async function handleImport() {
    const item = await importWallpaperDialog()
    if (item) {
      selectWallpaper(item)
      await handleApply(item)
    }
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
            Live wallpaper engine — select or double-click to apply to your desktop
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={handleImport}>
            <Plus size={15} /> Add Wallpaper
          </button>
        </div>
      </div>

      {/* Hero Preview Panel for Selected Wallpaper */}
      {activeWallpaper ? (
        <div className="card" style={{ marginBottom: 28, overflow: 'hidden', position: 'relative', height: 180 }}>
          <WallpaperPlayer
            engineId={activeWallpaper.engine}
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
                <div className="font-bold text-lg">{activeWallpaper.name}</div>
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
          onClick={handleImport}
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
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">Wallpapers</h2>
            <span className="badge font-mono">{filteredWallpapers.length}</span>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search wallpapers…"
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
            { id: 'all', label: `All (${allWallpapers.length})` },
            { id: 'builtin', label: `Built-in Canvas (${WALLPAPER_LIST.length})` },
            { id: 'custom', label: `Videos & Custom (${customWallpapers.length})` },
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

      {/* Unified Wallpaper Grid */}
      {filteredWallpapers.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)', marginBottom: 32 }}>
          <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          <div className="text-sm">No wallpapers matching "{searchQuery}"</div>
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

            return (
              <div
                key={wallpaper.id}
                className={`card wp-card ${isSelected ? 'card-active' : ''}`}
                onClick={() => selectWallpaper(wallpaper)}
                onDoubleClick={() => {
                  selectWallpaper(wallpaper)
                  handleApply(wallpaper)
                }}
              >
                {/* Preview area */}
                <div style={{ height: 110, background: '#000', position: 'relative' }}>
                  <WallpaperPlayer engineId={wallpaper.engine} config={wallpaper.defaultConfig} preview />

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

                  {wallpaper.isCustom && !isLive && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                      borderRadius: 999, padding: '2px 7px', fontSize: 9, fontWeight: 600, color: 'var(--color-brand)',
                      border: '1px solid color-mix(in srgb, var(--color-brand) 40%, transparent)', zIndex: 2,
                    }}>
                      VIDEO
                    </div>
                  )}

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
                        <Trash2 size={12} />
                      </button>
                    )}
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
    </div>
  )
}
