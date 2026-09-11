import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import {
  Monitor, Zap, Battery, Mic, Power, Layers, RefreshCw,
  LayoutTemplate, DownloadCloud, CheckCircle2, AlertCircle, ExternalLink, Sparkles, Eye,
  Sliders, Palette, ShieldCheck, Check, Volume2, VolumeX, Moon, Sun, Cpu,
  Trash2, Plus, Save, RotateCcw, Paintbrush
} from 'lucide-react'
import { checkForUpdate, openReleaseUrl, APP_VERSION } from '../lib/updater.js'
import { BUILTIN_THEMES } from '../engines/index.js'

const hexToRgbTuple = (hex) => {
  if (!hex || !hex.startsWith('#')) return hex
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return `${r}, ${g}, ${b}`
}

const STARTER_PRESETS = [
  {
    name: 'Cyber Neon',
    tokens: {
      '--rgb-base': '#0b0816',
      '--rgb-sidebar': '#130d24',
      '--rgb-card': '#1b1233',
      '--color-brand': '#8b5cf6',
      '--color-brand-hover': '#7c3aed',
      '--color-accent': '#06b6d4',
      '--text-main': '#f5f3ff',
      '--text-muted': '#a78bfa',
      '--border-main': '#2e1f54',
      '--border-accent': '#8b5cf6',
    }
  },
  {
    name: 'Emerald Matrix',
    tokens: {
      '--rgb-base': '#08120d',
      '--rgb-sidebar': '#0e1d15',
      '--rgb-card': '#14291e',
      '--color-brand': '#10b981',
      '--color-brand-hover': '#059669',
      '--color-accent': '#34d399',
      '--text-main': '#ecfdf5',
      '--text-muted': '#6ee7b7',
      '--border-main': '#1e3d2d',
      '--border-accent': '#10b981',
    }
  },
  {
    name: 'Solar Flare',
    tokens: {
      '--rgb-base': '#140c06',
      '--rgb-sidebar': '#21140b',
      '--rgb-card': '#2e1c0f',
      '--color-brand': '#f97316',
      '--color-brand-hover': '#ea580c',
      '--color-accent': '#fbbf24',
      '--text-main': '#fff7ed',
      '--text-muted': '#fdba74',
      '--border-main': '#4a2c17',
      '--border-accent': '#f97316',
    }
  },
  {
    name: 'Crimson Blood',
    tokens: {
      '--rgb-base': '#120808',
      '--rgb-sidebar': '#1c0d0d',
      '--rgb-card': '#291313',
      '--color-brand': '#ef4444',
      '--color-brand-hover': '#dc2626',
      '--color-accent': '#f87171',
      '--text-main': '#fef2f2',
      '--text-muted': '#fca5a5',
      '--border-main': '#451d1d',
      '--border-accent': '#ef4444',
    }
  },
  {
    name: 'Nordic Blue',
    tokens: {
      '--rgb-base': '#09131b',
      '--rgb-sidebar': '#0f1f2c',
      '--rgb-card': '#162b3d',
      '--color-brand': '#0ea5e9',
      '--color-brand-hover': '#0284c7',
      '--color-accent': '#38bdf8',
      '--text-main': '#f0f9ff',
      '--text-muted': '#7dd3fc',
      '--border-main': '#1e3e57',
      '--border-accent': '#0ea5e9',
    }
  },
]

const THEME_PALETTES = {
  'sovereign-onyx':      ['#09090b', '#1a1a20', '#3b82f6', '#60a5fa', '#fafafa'],
  'sovereign-slate':     ['#0c0f17', '#182030', '#6366f1', '#38bdf8', '#f1f5f9'],
  'sovereign-studio':    ['#0a0e0f', '#172225', '#10b981', '#2dd4bf', '#ecfdf5'],
  'sovereign-obsidian':  ['#0e0b08', '#221c15', '#f59e0b', '#fbbf24', '#fef3c7'],
  'sovereign-manifesto': ['#f5f0e8', '#fcfbfa', '#d42b2b', '#1a3dc4', '#0a0a0a'],
  'sovereign-light':     ['#f8fafc', '#ffffff', '#2563eb', '#0ea5e9', '#0f172a'],
}

function SettingRow({ label, desc, children }) {
  return (
    <div className="setting-row">
      <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
        <div className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{label}</div>
        {desc && <div className="text-xs text-muted" style={{ marginTop: 3, lineHeight: 1.45 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        {children}
      </div>
    </div>
  )
}

function SliderRow({ label, desc, value, set, min, max, step, fmt, presets }) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{label}</div>
          {desc && <div className="text-xs text-muted" style={{ marginTop: 2 }}>{desc}</div>}
        </div>
        <span className="telemetry-chip font-mono" style={{ color: 'var(--color-brand)' }}>
          {fmt ? fmt(value) : value}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <input
          type="range"
          className="slider"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => set(parseFloat(e.target.value))}
        />
        {presets && (
          <div className="flex gap-1.5" style={{ flexShrink: 0 }}>
            {presets.map(p => (
              <button
                key={p.val}
                type="button"
                className="btn btn-ghost"
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  height: 'auto',
                  border: value === p.val ? '1px solid var(--color-brand)' : '1px solid var(--border-subtle)',
                  color: value === p.val ? 'var(--color-brand)' : 'var(--text-muted)',
                  background: value === p.val ? 'color-mix(in srgb, var(--color-brand) 12%, transparent)' : 'transparent',
                }}
                onClick={() => set(p.val)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('performance')

  // Performance store bindings
  const fps = useStore(s => s.fps)
  const setFps = useStore(s => s.setFps)
  const autoStart = useStore(s => s.autoStart)
  const runInTray = useStore(s => s.runInTray)
  const toggleRunInTray = useStore(s => s.toggleRunInTray)
  const pauseOnBattery = useStore(s => s.pauseOnBattery)
  const togglePauseOnBattery = useStore(s => s.togglePauseOnBattery)
  const pauseOnFullscreen = useStore(s => s.pauseOnFullscreen)
  const togglePauseOnFullscreen = useStore(s => s.togglePauseOnFullscreen)
  const screenArrangement = useStore(s => s.screenArrangement)
  const setScreenArrangement = useStore(s => s.setScreenArrangement)

  // Appearance & Theme store bindings
  const activeTheme = useStore(s => s.activeTheme)
  const setActiveTheme = useStore(s => s.setActiveTheme)
  const customThemes = useStore(s => s.themes) || {}
  const saveCustomTheme = useStore(s => s.saveCustomTheme)
  const deleteCustomTheme = useStore(s => s.deleteCustomTheme)
  const glowAmbience = useStore(s => s.glowAmbience) || 'balanced'
  const setGlowAmbience = useStore(s => s.setGlowAmbience)
  const reducedMotion = useStore(s => s.reducedMotion) || false
  const toggleReducedMotion = useStore(s => s.toggleReducedMotion)

  // Custom Theme Studio State
  const [showCustomStudio, setShowCustomStudio] = useState(false)
  const [customThemeName, setCustomThemeName] = useState('My Custom Theme')
  const [customTokens, setCustomTokens] = useState({ ...STARTER_PRESETS[0].tokens })
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false)

  // Live preview custom tokens while studio is open
  useEffect(() => {
    if (!showCustomStudio) return
    Object.entries(customTokens).forEach(([k, val]) => {
      const finalVal = k.startsWith('--rgb-') ? hexToRgbTuple(val) : val
      document.documentElement.style.setProperty(k, finalVal)
    })
  }, [showCustomStudio, customTokens])

  const handleSaveCustomTheme = () => {
    const id = `custom-${Date.now()}`
    const finalTokens = {}
    Object.entries(customTokens).forEach(([k, val]) => {
      finalTokens[k] = k.startsWith('--rgb-') ? hexToRgbTuple(val) : val
    })
    finalTokens._meta = {
      name: customThemeName.trim() || 'Custom Theme',
      bg: customTokens['--rgb-base'],
      card: customTokens['--rgb-card'],
      accent: customTokens['--color-brand'],
      text: customTokens['--text-main'],
    }
    saveCustomTheme(id, finalTokens)
    setActiveTheme(id)
    setSaveSuccessMsg(true)
    setTimeout(() => setSaveSuccessMsg(false), 3000)
  }

  const handleCloseStudio = () => {
    setShowCustomStudio(false)
    setActiveTheme(activeTheme)
  }

  // Thumbnails store bindings
  const thumbnailMode = useStore(s => s.thumbnailMode) || 'hover'
  const setThumbnailMode = useStore(s => s.setThumbnailMode)

  // Audio store bindings
  const audioReactive = useStore(s => s.audioReactive)
  const toggleAudioReactive = useStore(s => s.toggleAudioReactive)
  const audioSource = useStore(s => s.audioSource)
  const setAudioSource = useStore(s => s.setAudioSource)
  const audioVolume = useStore(s => s.audioVolume)
  const setAudioVolume = useStore(s => s.setAudioVolume)
  const audioMuted = useStore(s => s.audioMuted)
  const toggleAudioMuted = useStore(s => s.toggleAudioMuted)

  // Taskbar store bindings
  const taskbarStyle = useStore(s => s.taskbarStyle) || 'default'
  const setTaskbarStyle = useStore(s => s.setTaskbarStyle)
  const taskbarBorder = useStore(s => s.taskbarBorder) || false
  const setTaskbarBorder = useStore(s => s.setTaskbarBorder)
  const translucentTbInstalled = useStore(s => s.translucentTbInstalled)
  const translucentTbRunning = useStore(s => s.translucentTbRunning)
  const syncTaskbarState = useStore(s => s.syncTaskbarState)
  const restartTaskbar = useStore(s => s.restartTaskbar)
  const [restartingTaskbar, setRestartingTaskbar] = useState(false)

  // Updates state
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateResult, setUpdateResult] = useState(null)

  useEffect(() => {
    syncTaskbarState?.().catch(() => {})
  }, [syncTaskbarState])

  useEffect(() => {
    async function checkAutostart() {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const enabled = await invoke('is_autostart_enabled')
        useStore.setState({ autoStart: !!enabled })
      } catch {
        try {
          const { isEnabled } = await import('@tauri-apps/plugin-autostart')
          const enabled = await isEnabled()
          useStore.setState({ autoStart: !!enabled })
        } catch {}
      }
    }
    checkAutostart()
  }, [])

  const handleToggleAutoStart = async () => {
    const nextVal = !autoStart
    useStore.setState({ autoStart: nextVal })
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const res = await invoke('set_autostart', { enabled: nextVal })
      useStore.setState({ autoStart: !!res })
    } catch (err) {
      try {
        const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart')
        if (nextVal) await enable()
        else await disable()
        const verified = await isEnabled()
        useStore.setState({ autoStart: verified })
      } catch {}
    }
  }

  const handleFpsChange = (v) => {
    setFps(v)
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('update_wallpaper_config', { config: { fps: v }, monitorLabel: null }).catch(() => {})
    }).catch(() => {})
  }

  const handleTogglePauseOnBattery = () => {
    const nextVal = !pauseOnBattery
    togglePauseOnBattery()
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('sync_performance_settings', {
        pauseOnBattery: nextVal,
        pauseOnFullscreen: pauseOnFullscreen,
      }).catch(() => {})
    }).catch(() => {})
  }

  const handleTogglePauseOnFullscreen = () => {
    const nextVal = !pauseOnFullscreen
    togglePauseOnFullscreen()
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('sync_performance_settings', {
        pauseOnBattery: pauseOnBattery,
        pauseOnFullscreen: nextVal,
      }).catch(() => {})
    }).catch(() => {})
  }

  const handleVolumeChange = (v) => {
    setAudioVolume(v)
    const nextMuted = v <= 0
    if (audioMuted && v > 0) {
      useStore.setState({ audioMuted: false })
    }
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('set_mpv_volume', { monitorLabel: null, volume: v }).catch(() => {})
      invoke('set_mpv_mute', { monitorLabel: null, muted: nextMuted }).catch(() => {})
      invoke('update_wallpaper_config', { config: { volume: v, muted: nextMuted }, monitorLabel: null }).catch(() => {})
    }).catch(() => {})
  }

  const handleMuteToggle = () => {
    const nextMuted = !audioMuted
    toggleAudioMuted()
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('set_mpv_mute', { monitorLabel: null, muted: nextMuted }).catch(() => {})
      invoke('update_wallpaper_config', { config: { muted: nextMuted }, monitorLabel: null }).catch(() => {})
    }).catch(() => {})
  }

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    setUpdateResult(null)
    const result = await checkForUpdate()
    setUpdateResult(result)
    setCheckingUpdate(false)
  }

  const TABS = [
    { id: 'performance', label: 'Performance', icon: Zap },
    { id: 'appearance',  label: 'Appearance',  icon: Palette },
    { id: 'thumbnails',  label: 'Thumbnails',  icon: Eye },
    { id: 'taskbar',     label: 'Taskbar',     icon: LayoutTemplate },
    { id: 'audio',       label: 'Audio',       icon: Mic },
    { id: 'system',      label: 'System',      icon: Power },
  ]

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 840, margin: '0 auto', paddingBottom: 40 }}>
      {/* Page Header with Executive Telemetry */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ letterSpacing: '-0.5px' }}>
            Settings & Preferences
          </h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Fine-tune AetherFlow performance, visual aesthetics, audio, and Windows desktop integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="telemetry-chip">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-emerald)', display: 'inline-block' }} />
            <span>v{APP_VERSION}</span>
          </span>
        </div>
      </div>

      {/* Category Navigation Bar (Surrealist / CureSync Inspired) */}
      <nav className="settings-nav-bar" aria-label="Settings Categories">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              className={`settings-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Tab 1: Performance ──────────────────────────────────────────────── */}
      {activeTab === 'performance' && (
        <div className="animate-fadeIn">
          <div className="setting-card">
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <Zap size={16} style={{ color: 'var(--color-brand)' }} />
                <span className="text-sm font-semibold">Engine & Display Performance</span>
              </div>
              <span className="badge font-mono" style={{ fontSize: 10 }}>Active</span>
            </div>

            <SliderRow
              label="Rendering Frame Cap"
              desc="Target frame rate limit for Canvas 2D engines & video renderers"
              value={fps}
              set={handleFpsChange}
              min={10}
              max={120}
              step={10}
              fmt={v => v >= 120 ? '120 FPS (Max)' : `${v} FPS`}
              presets={[
                { label: '30 FPS', val: 30 },
                { label: '60 FPS', val: 60 },
                { label: '120 FPS', val: 120 },
              ]}
            />

            <SettingRow
              label="Pause on Battery Power"
              desc="Automatically suspends live animation and hardware video decoding when unplugged to conserve battery life"
            >
              <label className="toggle">
                <input type="checkbox" checked={pauseOnBattery} onChange={handleTogglePauseOnBattery} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </SettingRow>

            <SettingRow
              label="Pause on Fullscreen Applications"
              desc="Halt wallpaper rendering while 3D games or fullscreen applications are active to maximize GPU resources"
            >
              <label className="toggle">
                <input type="checkbox" checked={pauseOnFullscreen} onChange={handleTogglePauseOnFullscreen} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </SettingRow>

            <div style={{ padding: '14px 18px' }}>
              <div className="text-sm font-semibold" style={{ marginBottom: 4 }}>Multi-Display Screen Arrangement</div>
              <div className="text-xs text-muted" style={{ marginBottom: 12 }}>
                {screenArrangement === 'duplicate' 
                  ? 'Duplicate: Active wallpaper is replicated across all connected monitors.' 
                  : 'Per-Screen: Assign unique individual wallpapers to each display from the Home dashboard.'}
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-item ${screenArrangement === 'duplicate' ? 'active-brand' : ''}`}
                  onClick={() => setScreenArrangement('duplicate')}
                >
                  Duplicate Across All
                </button>
                <button
                  type="button"
                  className={`segmented-item ${screenArrangement === 'per-screen' ? 'active-brand' : ''}`}
                  onClick={() => setScreenArrangement('per-screen')}
                >
                  Distinct Per-Screen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Appearance & Themes ─────────────────────────────────────── */}
      {activeTab === 'appearance' && (
        <div className="animate-fadeIn">
          {/* Preset Themes Gallery */}
          <div className="setting-card">
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <Palette size={16} style={{ color: 'var(--color-accent)' }} />
                <span className="text-sm font-semibold">Sovereign Theme Presets</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 11.5, padding: '4px 12px', height: 28 }}
                onClick={() => setShowCustomStudio(prev => !prev)}
              >
                <Plus size={13} /> {showCustomStudio ? 'Hide Theme Studio' : 'Customize & Create Theme'}
              </button>
            </div>

            <div style={{ padding: '16px 18px' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 14 }}>
                Select a visual identity or create a custom theme. All UI surfaces, elevations, accents, and glows will instantly adapt.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {/* Built-in Themes */}
                {BUILTIN_THEMES.map(theme => {
                  const isSelected = activeTheme === theme.id
                  const palette = THEME_PALETTES[theme.id] || [theme.bg, '#1e2025', theme.accent, '#38bdf8', '#ffffff']
                  return (
                    <div
                      key={theme.id}
                      className={`option-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setActiveTheme(theme.id)}
                    >
                      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: theme.accent,
                              boxShadow: `0 0 10px ${theme.accent}`,
                            }}
                          />
                          <span className="font-semibold text-sm" style={{ color: isSelected ? 'var(--color-brand)' : 'var(--text-main)' }}>
                            {theme.name}
                          </span>
                        </div>
                        {isSelected ? (
                          <span
                            style={{
                              width: 18, height: 18, borderRadius: '50%',
                              background: 'var(--color-brand)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', flexShrink: 0
                            }}
                          >
                            <Check size={11} strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: 10, textTransform: 'capitalize' }}>
                            {theme.category}
                          </span>
                        )}
                      </div>

                      {/* Swatch color row */}
                      <div className="flex items-center gap-1.5" style={{ marginTop: 'auto', paddingTop: 6 }}>
                        {palette.map((color, i) => (
                          <span
                            key={i}
                            style={{
                              flex: 1,
                              height: 6,
                              borderRadius: 3,
                              background: color,
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* User-Saved Custom Themes */}
                {Object.entries(customThemes).map(([id, tokens]) => {
                  const isSelected = activeTheme === id
                  const meta = tokens._meta || {
                    name: 'Custom Theme',
                    bg: tokens['--rgb-base'] || '#09090b',
                    card: tokens['--rgb-card'] || '#1a1a20',
                    accent: tokens['--color-brand'] || '#3b82f6',
                    text: tokens['--text-main'] || '#fafafa',
                  }
                  const palette = [
                    meta.bg?.startsWith('#') ? meta.bg : '#09090b',
                    meta.card?.startsWith('#') ? meta.card : '#1a1a20',
                    meta.accent?.startsWith('#') ? meta.accent : '#3b82f6',
                    meta.text?.startsWith('#') ? meta.text : '#fafafa',
                  ]
                  return (
                    <div
                      key={id}
                      className={`option-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setActiveTheme(id)}
                    >
                      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: meta.accent,
                              boxShadow: `0 0 10px ${meta.accent}`,
                              flexShrink: 0,
                            }}
                          />
                          <span className="font-semibold text-sm truncate" style={{ color: isSelected ? 'var(--color-brand)' : 'var(--text-main)' }}>
                            {meta.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isSelected && (
                            <span
                              style={{
                                width: 18, height: 18, borderRadius: '50%',
                                background: 'var(--color-brand)',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff',
                              }}
                            >
                              <Check size={11} strokeWidth={3} />
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn-icon"
                            style={{ padding: 4, color: 'var(--text-muted)' }}
                            title="Delete custom theme"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteCustomTheme(id)
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Swatch color row */}
                      <div className="flex items-center gap-1.5" style={{ marginTop: 'auto', paddingTop: 6 }}>
                        {palette.map((color, i) => (
                          <span
                            key={i}
                            style={{
                              flex: 1,
                              height: 6,
                              borderRadius: 3,
                              background: color,
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Custom Theme Studio */}
          {showCustomStudio && (
            <div className="setting-card animate-fadeIn" style={{ border: '1px solid var(--color-brand)' }}>
              <div className="setting-card-header" style={{ background: 'color-mix(in srgb, var(--color-brand) 8%, var(--bg-card))' }}>
                <div className="flex items-center gap-2.5">
                  <Paintbrush size={16} style={{ color: 'var(--color-brand)' }} />
                  <span className="text-sm font-semibold">Custom Theme Studio</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-brand font-mono" style={{ fontSize: 10 }}>Live CSS Engine</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '3px 8px', height: 24 }}
                    onClick={handleCloseStudio}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div style={{ padding: '16px 18px' }}>
                {saveSuccessMsg && (
                  <div
                    className="flex items-center gap-2"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'color-mix(in srgb, var(--color-emerald) 15%, transparent)',
                      border: '1px solid var(--color-emerald)',
                      color: 'var(--color-emerald)',
                      marginBottom: 16,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <Check size={15} /> Custom theme saved and activated!
                  </div>
                )}

                {/* Theme Name & Starter Templates */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted block" style={{ marginBottom: 6 }}>
                      Theme Name
                    </label>
                    <input
                      type="text"
                      value={customThemeName}
                      onChange={e => setCustomThemeName(e.target.value)}
                      placeholder="e.g., Cyberpunk Sunset, Nordic Frost"
                      style={{
                        width: '100%',
                        maxWidth: 360,
                        padding: '8px 12px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-main)',
                        borderRadius: 8,
                        color: 'var(--text-main)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Starter Templates */}
                  <div>
                    <div className="text-xs text-muted" style={{ marginBottom: 8, fontWeight: 500 }}>
                      Quick Starter Templates (click to load colors):
                    </div>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      {STARTER_PRESETS.map(starter => (
                        <button
                          key={starter.name}
                          type="button"
                          className="btn btn-ghost"
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            height: 'auto',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                          }}
                          onClick={() => {
                            setCustomTokens({ ...starter.tokens })
                            setCustomThemeName(starter.name)
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: starter.tokens['--color-brand'],
                              display: 'inline-block',
                              marginRight: 4,
                            }}
                          />
                          {starter.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Color Pickers Grid */}
                <div className="text-xs font-semibold uppercase tracking-wider text-muted" style={{ marginBottom: 10 }}>
                  Theme Color Tokens (Live Preview)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { key: '--rgb-base', label: 'Background / Base', desc: 'Main window backdrop' },
                    { key: '--rgb-card', label: 'Cards & Panels', desc: 'Content surface elevation' },
                    { key: '--rgb-sidebar', label: 'Sidebar Rail', desc: 'Navigation background' },
                    { key: '--color-brand', label: 'Primary Brand Accent', desc: 'Buttons, badges, focus' },
                    { key: '--color-accent', label: 'Secondary Accent', desc: 'Highlights & glowing dots' },
                    { key: '--text-main', label: 'Primary Text', desc: 'Headings and high-contrast text' },
                    { key: '--text-muted', label: 'Muted Text', desc: 'Descriptions and captions' },
                  ].map(({ key, label, desc }) => {
                    const rawVal = customTokens[key] || '#ffffff'
                    return (
                      <div
                        key={key}
                        style={{
                          background: 'color-mix(in srgb, var(--border-main) 25%, var(--bg-card))',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{label}</span>
                          <span className="font-mono text-xs text-muted">{rawVal}</span>
                        </div>
                        <div className="flex items-center gap-3" style={{ marginTop: 2 }}>
                          <input
                            type="color"
                            value={rawVal}
                            onChange={e => setCustomTokens(prev => ({ ...prev, [key]: e.target.value }))}
                            style={{
                              width: 36,
                              height: 28,
                              padding: 0,
                              borderRadius: 6,
                              border: '1px solid var(--border-main)',
                              cursor: 'pointer',
                              background: 'transparent',
                            }}
                          />
                          <span className="text-xs text-muted" style={{ fontSize: 10.5 }}>{desc}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Studio Footer Action Buttons */}
                <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={handleCloseStudio}
                  >
                    <RotateCcw size={13} /> Cancel & Reset
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '8px 20px' }}
                    onClick={handleSaveCustomTheme}
                  >
                    <Save size={14} /> Save & Apply Custom Theme
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Visual Ambience & Motion Dynamics (Replaces material surface sliders) */}
          <div className="setting-card">
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} style={{ color: 'var(--color-highlight)' }} />
                <span className="text-sm font-semibold">Visual Ambience & Dynamics</span>
              </div>
              <span className="badge font-mono" style={{ fontSize: 10 }}>Display Feel</span>
            </div>

            <SettingRow
              label="Accent Glow Ambience"
              desc="Controls the intensity of neon aura halos, specular glows, and brand shadows across UI controls"
            >
              <div className="segmented-control">
                {[
                  { id: 'vivid', label: 'Vivid' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'subtle', label: 'Subtle' },
                  { id: 'off', label: 'Off' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`segmented-item ${glowAmbience === opt.id ? 'active-brand' : ''}`}
                    onClick={() => setGlowAmbience(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow
              label="Reduced Motion / Snappy UI"
              desc="Disables dynamic spring animations and layout transitions for instantaneous zero-latency responsiveness"
            >
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={toggleReducedMotion}
                />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </SettingRow>
          </div>
        </div>
      )}

      {/* ── Tab 3: Card Thumbnails ─────────────────────────────────────────── */}
      {activeTab === 'thumbnails' && (
        <div className="animate-fadeIn">
          <div className="setting-card">
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <Eye size={16} style={{ color: 'var(--color-cyan)' }} />
                <span className="text-sm font-semibold">Thumbnail Presentation Modes</span>
              </div>
              <span className="badge badge-brand font-mono" style={{ fontSize: 10 }}>Memory Saver</span>
            </div>

            <div style={{ padding: '16px 18px' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 16 }}>
                Control how wallpaper cards render previews across Home and Library screens. AetherFlow strictly limits hardware decoders to only visible cards.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {[
                  {
                    id: 'hover',
                    label: 'On Hover (Recommended)',
                    tag: 'Ultra Fast',
                    desc: 'Zero-RAM vector badges. Plays live video & animation previews only when hovering over a card.',
                  },
                  {
                    id: 'always',
                    label: 'Always On',
                    tag: 'Media Previews',
                    desc: 'Always displays full image and video poster frames. Utilizes viewport lazy loading.',
                  },
                  {
                    id: 'off',
                    label: 'Clean Minimal (Off)',
                    tag: 'Zero Decoder',
                    desc: 'Renders sleek vector badges only. Lowest possible CPU and GPU overhead.',
                  },
                ].map(m => {
                  const isSelected = thumbnailMode === m.id
                  return (
                    <div
                      key={m.id}
                      className={`option-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setThumbnailMode(m.id)}
                    >
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <span className="font-semibold text-sm" style={{ color: isSelected ? 'var(--color-brand)' : 'var(--text-main)' }}>
                          {m.label}
                        </span>
                        {isSelected ? (
                          <span
                            style={{
                              width: 18, height: 18, borderRadius: '50%',
                              background: 'var(--color-brand)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', flexShrink: 0
                            }}
                          >
                            <Check size={11} strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: 10 }}>{m.tag}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
                        {m.desc}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: Windows Taskbar ─────────────────────────────────────────── */}
      {activeTab === 'taskbar' && (
        <div className="animate-fadeIn">
          <div className="setting-card">
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <LayoutTemplate size={16} style={{ color: 'var(--color-brand)' }} />
                <span className="text-sm font-semibold">Windows Taskbar Customization</span>
              </div>
              <span className="badge font-mono" style={{ fontSize: 10 }}>Win32 Hook</span>
            </div>

            <div style={{ padding: '16px 18px' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 14 }}>
                Apply high-performance native transparency or frosted acrylic blur to Windows taskbars on all connected displays.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {[
                  { id: 'default', label: 'Default', desc: 'Windows standard style' },
                  { id: 'clear',   label: 'Clear (100%)', desc: '100% transparent glass' },
                  { id: 'acrylic', label: 'Acrylic Blur', desc: 'Frosted acrylic with noise' },
                  { id: 'blur',    label: 'Soft Blur', desc: 'Smooth Gaussian blur' },
                ].map(style => {
                  const isSelected = taskbarStyle === style.id
                  return (
                    <div
                      key={style.id}
                      className={`option-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setTaskbarStyle(style.id)}
                    >
                      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <span className="font-semibold text-sm" style={{ color: isSelected ? 'var(--color-brand)' : 'var(--text-main)' }}>
                          {style.label}
                        </span>
                        {isSelected && (
                          <span
                            style={{
                              width: 18, height: 18, borderRadius: '50%',
                              background: 'var(--color-brand)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', flexShrink: 0
                            }}
                          >
                            <Check size={11} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {style.desc}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Taskbar Top Border Separator */}
            <SettingRow
              label="Taskbar Top Border Separator"
              desc={taskbarBorder ? 'Showing thin 1px top border line' : 'Clean borderless edge with zero top separator line'}
            >
              <button
                type="button"
                className={`btn ${taskbarBorder ? 'btn-ghost' : 'btn-primary'}`}
                style={{ fontSize: 12, padding: '6px 14px', height: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => setTaskbarBorder(!taskbarBorder)}
              >
                {!taskbarBorder && <CheckCircle2 size={13} />}
                {taskbarBorder ? 'Border: Visible' : 'Borderless Edge'}
              </button>
            </SettingRow>

            {/* TranslucentTB Telemetry & Recovery */}
            <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.015)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">TranslucentTB Status:</span>
                  <span className={`badge ${translucentTbInstalled && translucentTbRunning ? 'badge-brand' : translucentTbInstalled ? 'badge-amber' : 'badge-ghost'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                    {translucentTbInstalled && translucentTbRunning ? 'Active & Synced' : translucentTbInstalled ? 'Installed (Stopped)' : 'Not Installed'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={restartingTaskbar}
                  style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-subtle)', borderRadius: 6 }}
                  onClick={async () => {
                    setRestartingTaskbar(true)
                    await restartTaskbar()
                    setTimeout(() => setRestartingTaskbar(false), 1200)
                  }}
                >
                  <RefreshCw size={11} className={restartingTaskbar ? 'animate-spin' : ''} />
                  {restartingTaskbar ? 'Recovering…' : 'Recover Taskbar'}
                </button>
              </div>
              <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
                AetherFlow seamlessly synchronizes with TranslucentTB if installed, avoiding XAML conflicts while maintaining instantaneous style application.
              </div>
              {!translucentTbInstalled && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '5px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-main)', borderRadius: 6, marginTop: 10 }}
                  onClick={() => {
                    import('@tauri-apps/api/core').then(({ invoke }) => {
                      invoke('open_url', { url: 'ms-windows-store://pdp/?ProductId=9PF4KZ2VN4W9' })
                        .catch(() => {
                          invoke('open_url', { url: 'https://apps.microsoft.com/detail/9pf4kz2vn4w9' }).catch(() => {})
                        })
                    }).catch(() => {
                      window.open('https://apps.microsoft.com/detail/9pf4kz2vn4w9', '_blank')
                    })
                  }}
                >
                  <ExternalLink size={12} /> Get TranslucentTB on Microsoft Store (Free)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: Audio & Reactivity ───────────────────────────────────────── */}
      {activeTab === 'audio' && (
        <div className="animate-fadeIn">
          <div className="setting-card">
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <Mic size={16} style={{ color: 'var(--color-rose)' }} />
                <span className="text-sm font-semibold">Audio & Reactive Engine</span>
              </div>
              <span className="telemetry-chip font-mono" style={{ color: audioMuted ? 'var(--color-rose)' : 'var(--color-emerald)' }}>
                {audioMuted ? 'MUTED' : `${audioVolume}%`}
              </span>
            </div>

            <SliderRow
              label="Master Wallpaper Volume"
              desc="Controls audio output across all active video and YouTube wallpapers"
              value={audioVolume}
              set={handleVolumeChange}
              min={0}
              max={100}
              step={1}
              fmt={v => `${v}%`}
              presets={[
                { label: '0%', val: 0 },
                { label: '50%', val: 50 },
                { label: '100%', val: 100 },
              ]}
            />

            <SettingRow
              label="Mute All Wallpapers"
              desc="Silences all audio immediately without changing slider level"
            >
              <label className="toggle">
                <input type="checkbox" checked={audioMuted} onChange={handleMuteToggle} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </SettingRow>

            <SettingRow
              label="Audio Reactive Mode"
              desc="Enables visual pulses and particle reactions synchronized to real-time audio input"
            >
              <label className="toggle">
                <input type="checkbox" checked={audioReactive} onChange={toggleAudioReactive} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </SettingRow>

            {audioReactive && (
              <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.02)' }}>
                <div className="text-sm font-semibold" style={{ marginBottom: 4 }}>Reactive Audio Source</div>
                <div className="text-xs text-muted" style={{ marginBottom: 10 }}>
                  Choose which input stream drives audio reactive visual effects
                </div>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-item ${audioSource === 'mic' ? 'active-brand' : ''}`}
                    onClick={() => setAudioSource('mic')}
                  >
                    Microphone
                  </button>
                  <button
                    type="button"
                    className={`segmented-item ${audioSource === 'system' ? 'active-brand' : ''}`}
                    onClick={() => setAudioSource('system')}
                  >
                    System Audio (CAVA)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 6: System & Software Updates ───────────────────────────────── */}
      {activeTab === 'system' && (
        <div className="animate-fadeIn">
          {/* Windows System Behavior */}
          <div className="setting-card">
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <Power size={16} style={{ color: 'var(--color-amber)' }} />
                <span className="text-sm font-semibold">System Integration</span>
              </div>
            </div>

            <SettingRow
              label="Launch on Windows Startup"
              desc="Automatically start AetherFlow minimized when Windows boots"
            >
              <label className="toggle">
                <input type="checkbox" checked={autoStart} onChange={handleToggleAutoStart} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </SettingRow>

            <SettingRow
              label="Minimize to System Tray on Close"
              desc="Keep wallpaper engine running in the background when the control panel window is closed"
            >
              <label className="toggle">
                <input type="checkbox" checked={runInTray} onChange={toggleRunInTray} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </SettingRow>
          </div>

          {/* Software Updates */}
          <div className="setting-card">
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <DownloadCloud size={16} style={{ color: 'var(--color-brand)' }} />
                <span className="text-sm font-semibold">Software Updates</span>
              </div>
              <span className="badge font-mono" style={{ fontSize: 10 }}>GitHub Releases</span>
            </div>

            <div style={{ padding: '16px 18px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <span>Installed Release:</span>
                    <span className="badge font-mono badge-brand">v{APP_VERSION}</span>
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                    Continuous automated updates powered by Tauri & GitHub
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate}
                  style={{ fontSize: 12, padding: '6px 14px', height: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={13} className={checkingUpdate ? 'animate-spin' : ''} />
                  {checkingUpdate ? 'Checking…' : 'Check for Updates'}
                </button>
              </div>

              {updateResult && (
                <div style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid var(--border-main)',
                  background: updateResult.hasUpdate
                    ? 'color-mix(in srgb, var(--color-brand) 12%, transparent)'
                    : 'rgba(0,0,0,0.2)',
                }}>
                  {updateResult.hasUpdate ? (
                    <div>
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-brand" />
                          <span className="font-semibold text-sm">Update Available: {updateResult.latestTag}</span>
                        </div>
                        <span className="text-xs text-muted">
                          {updateResult.publishedAt ? new Date(updateResult.publishedAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                      {updateResult.releaseNotes && (
                        <div className="text-xs text-muted" style={{
                          maxHeight: 120,
                          overflowY: 'auto',
                          padding: 8,
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: 6,
                          whiteSpace: 'pre-wrap',
                          marginBottom: 12,
                          fontFamily: 'monospace',
                        }}>
                          {updateResult.releaseNotes}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '5px 12px', height: 'auto' }}
                          onClick={() => openReleaseUrl(updateResult.releaseUrl)}
                        >
                          <ExternalLink size={12} style={{ marginRight: 4 }} /> View on GitHub
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ fontSize: 12, padding: '5px 14px', height: 'auto' }}
                          onClick={() => openReleaseUrl(updateResult.downloadUrl)}
                        >
                          <DownloadCloud size={13} style={{ marginRight: 6 }} /> Download Update
                        </button>
                      </div>
                    </div>
                  ) : updateResult.error ? (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-rose)' }}>
                      <AlertCircle size={14} />
                      <span>Unable to check updates: {updateResult.error}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-emerald)' }}>
                      <CheckCircle2 size={14} />
                      <span>You are running the latest version of AetherFlow (v{APP_VERSION})</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer credits */}
      <div className="text-xs text-muted" style={{ textAlign: 'center', marginTop: 24 }}>
        AetherFlow v{APP_VERSION} · Sovereign Desktop Visual Engine · Lightweight & Fast (~30MB RAM)
      </div>
    </div>
  )
}
