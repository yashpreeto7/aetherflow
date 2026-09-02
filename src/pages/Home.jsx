import React, { useState, useEffect } from 'react'
import { Play, Zap, MonitorPlay, Square, Monitor } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { WALLPAPER_LIST, BUILTIN_THEMES } from '../engines/index.js'
import WallpaperPlayer from '../components/WallpaperPlayer/index.jsx'
import ThemeEditor from '../components/ThemeEditor/index.jsx'

// ── Tauri IPC helpers (graceful fallback when running in browser) ─────────────
async function tauriInvoke(cmd, args) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke(cmd, args)
  } catch {
    console.warn('[AuraOS] Tauri not available — command skipped:', cmd)
  }
}

export default function HomePage() {
  const [showThemeEditor, setShowThemeEditor] = React.useState(false)
  const [applying, setApplying] = React.useState(false)

  const activeWallpaper       = useStore(s => s.activeWallpaper)
  const setActiveWallpaper    = useStore(s => s.setActiveWallpaper)
  const isWallpaperRunning    = useStore(s => s.isWallpaperRunning)
  const setWallpaperRunning   = useStore(s => s.setWallpaperRunning)
  const activeTheme           = useStore(s => s.activeTheme)
  const setActiveTheme        = useStore(s => s.setActiveTheme)
  const customThemes          = useStore(s => s.themes)
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
    // Fetch monitors on mount
    tauriInvoke('get_monitors')
      .then(res => {
        if (res && res.length > 0) {
          // Sort monitors: Primary first, then left-to-right by X coordinate
          res.sort((a, b) => {
            if (a.isPrimary && !b.isPrimary) return -1;
            if (!a.isPrimary && b.isPrimary) return 1;
            return a.x - b.x;
          });
          setMonitors(res)
          if (!selectedMonitorLabel) {
             setSelectedMonitorLabel(res[0].label)
          }
        }
      })
      .catch(e => console.error("Failed to fetch monitors", e))
  }, [])

  function handleSelectMonitor(label) {
    setSelectedMonitorLabel(label)
    if (monitorWallpapers && monitorWallpapers[label]) {
      setActiveWallpaper(monitorWallpapers[label])
    }
  }

  // ── Select a wallpaper (just marks it as "selected" in the control panel) ──
  function selectWallpaper(engine) {
    setActiveWallpaper({
      id: engine.id,
      name: engine.name,
      engine: engine.id,
      config: { ...engine.defaultConfig, speedMultiplier: wallpaperSpeed },
    })
  }

  // ── Apply to desktop (calls Rust → pins wallpaper window into WorkerW) ──────
  async function applyToDesktop() {
    if (!activeWallpaper) return
    setApplying(true)
    try {
      const targetLabel = screenArrangement === 'per-screen' ? selectedMonitorLabel : null;
      await tauriInvoke('apply_wallpaper', {
        engineId:   activeWallpaper.engine,
        config:     { 
          ...activeWallpaper.config, 
          speedMultiplier: wallpaperSpeed,
          volume: audioVolume,
          muted: audioMuted
        },
        opacity:    wallpaperOpacity,
        brightness: wallpaperBrightness,
        monitorLabel: targetLabel,
      })
      if (targetLabel) {
        setMonitorWallpaper(targetLabel, activeWallpaper)
      }
      setWallpaperRunning(true)
    } finally {
      setApplying(false)
    }
  }

  // ── Stop the live wallpaper ──────────────────────────────────────────────────
  async function stopWallpaper() {
    const targetLabel = screenArrangement === 'per-screen' ? selectedMonitorLabel : null;
    await tauriInvoke('stop_wallpaper', { monitorLabel: targetLabel })
    if (targetLabel) {
      setMonitorWallpaper(targetLabel, null)
    }
    setWallpaperRunning(false)
  }

  // ── Live-update brightness/opacity while sliders move ────────────────────────
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
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 className="font-display font-bold text-2xl" style={{ letterSpacing: '-0.5px' }}>
          Welcome to <span className="text-brand">AuraOS</span>
        </h1>
        <p className="text-muted text-sm" style={{ marginTop: 4 }}>
          Live wallpaper engine — pick a wallpaper below, then hit Apply
        </p>
      </div>

      {/* Selected wallpaper hero / action area */}
      {activeWallpaper ? (
        <div className="card" style={{ marginBottom: 28, overflow: 'hidden', position: 'relative', height: 170 }}>
          {/* Preview canvas (preview mode — no z-index tricks, just displays in card) */}
          <WallpaperPlayer
            engineId={activeWallpaper.engine}
            config={activeWallpaper.config}
            preview
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)',
            display: 'flex', alignItems: 'flex-end', padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', gap: 12 }}>
              <div>
                {isWallpaperRunning && (
                  <div className="badge badge-brand" style={{ marginBottom: 6 }}>
                    <Zap size={10} style={{ marginRight: 4 }} /> LIVE ON DESKTOP
                  </div>
                )}
                <div className="font-semibold">{activeWallpaper.name}</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {isWallpaperRunning && (
                  <button
                    className="btn"
                    style={{ background: 'rgba(255,60,60,0.2)', color: '#ff6060', border: '1px solid rgba(255,60,60,0.3)' }}
                    onClick={stopWallpaper}
                  >
                    <Square size={13} style={{ marginRight: 6 }} />
                    Stop
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={applyToDesktop}
                  disabled={applying}
                  style={{ opacity: applying ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <MonitorPlay size={14} />
                  {applying ? 'Applying…' : isWallpaperRunning ? 'Re-apply' : 'Apply to Desktop'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{
          marginBottom: 28, padding: 32, textAlign: 'center',
          border: '1.5px dashed var(--border-main)',
          background: 'transparent',
        }}>
          <Play size={24} style={{ color: 'var(--text-subtle)', marginBottom: 8 }} />
          <div className="text-muted text-sm">No wallpaper selected. Pick one from the grid below ↓</div>
        </div>
      )}

      {/* Controls (opacity / brightness / speed) */}
      {activeWallpaper && (
        <div className="card p-4" style={{ marginBottom: 28 }}>
          {screenArrangement === 'per-screen' && monitors.length > 1 && (
            <div style={{ marginBottom: 24, padding: '16px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-main)' }}>
              <div className="text-sm font-medium" style={{ marginBottom: 12 }}>Target Monitor</div>
              <div className="flex gap-2">
                {monitors.map((m, i) => {
                  const isSelected = selectedMonitorLabel === m.label
                  const monWp = monitorWallpapers?.[m.label]
                  return (
                    <button 
                      key={m.label} 
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => handleSelectMonitor(m.label)}
                      style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
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

      {/* Wallpaper grid */}
      <h2 className="font-semibold text-base" style={{ marginBottom: 14 }}>Live Wallpapers</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 32 }}>
        {WALLPAPER_LIST.map(engine => {
          const isSelected = activeWallpaper?.id === engine.id
          const isLive     = isSelected && isWallpaperRunning
          return (
            <div
              key={engine.id}
              className={`card card-interactive ${isSelected ? 'card-active' : ''}`}
              style={{ overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => selectWallpaper(engine)}
            >
              {/* Thumbnail preview canvas */}
              <div style={{ height: 100, background: '#000', position: 'relative' }}>
                <WallpaperPlayer engineId={engine.id} config={engine.defaultConfig} preview />
                {isLive && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'var(--color-brand)', borderRadius: 999,
                    padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#fff',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Zap size={8} /> LIVE
                  </div>
                )}
                {isSelected && !isLive && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(255,255,255,0.15)', borderRadius: 999,
                    padding: '2px 8px', fontSize: 10, fontWeight: 600, color: '#fff',
                  }}>SELECTED</div>
                )}
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div className="font-medium text-sm truncate">{engine.name}</div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>{engine.tags.slice(0, 2).join(', ')}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Theme selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 className="font-semibold text-base">Themes</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
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
