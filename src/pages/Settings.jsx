import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore.js'
import {
  Monitor, Zap, Battery, Mic, Power, Layers, RefreshCw,
  LayoutTemplate, DownloadCloud, CheckCircle2, AlertCircle, ExternalLink, Sparkles, Eye,
  Sliders, Palette, ShieldCheck, Check, Volume2, VolumeX, Moon, Sun, Cpu,
  Trash2, Plus, Save, RotateCcw, Paintbrush, User, Upload, Download, Copy,
  LogIn, LogOut, Shield, Globe, Key, FileText, Cloud, FileDown, FileUp, Folder, FolderOpen
} from 'lucide-react'
import { checkForUpdate, openReleaseUrl, APP_VERSION } from '../lib/updater.js'
import { BUILTIN_THEMES } from '../engines/index.js'
import UserAvatar from '../components/UserAvatar/index.jsx'
import { signOut, isOnline } from '../lib/supabase.js'

const hexToRgbTuple = (hex) => {
  if (!hex || !hex.startsWith('#')) return hex
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  return `${r}, ${g}, ${b}`
}

const rgbTupleToHex = (tuple) => {
  if (!tuple) return '#000000'
  if (typeof tuple === 'string' && tuple.startsWith('#')) return tuple
  const parts = String(tuple).split(',').map(s => parseInt(s.trim(), 10) || 0)
  if (parts.length < 3) return '#000000'
  const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`
}

const BUILTIN_THEME_TOKENS = {
  'sovereign-onyx': {
    '--rgb-base': '9, 9, 11',
    '--rgb-sidebar': '17, 17, 20',
    '--rgb-card': '26, 26, 32',
    '--color-brand': '#3b82f6',
    '--color-brand-hover': '#2563eb',
    '--color-accent': '#60a5fa',
    '--text-main': '#fafafa',
    '--text-muted': '#a1a1aa',
    '--border-main': '#27272a',
    '--border-accent': '#3b82f6',
  },
  'sovereign-slate': {
    '--rgb-base': '12, 15, 23',
    '--rgb-sidebar': '18, 23, 34',
    '--rgb-card': '24, 32, 48',
    '--color-brand': '#6366f1',
    '--color-brand-hover': '#4f46e5',
    '--color-accent': '#38bdf8',
    '--text-main': '#f1f5f9',
    '--text-muted': '#94a3b8',
    '--border-main': '#1e2d4a',
    '--border-accent': '#6366f1',
  },
  'sovereign-studio': {
    '--rgb-base': '10, 14, 15',
    '--rgb-sidebar': '17, 24, 26',
    '--rgb-card': '23, 34, 37',
    '--color-brand': '#10b981',
    '--color-brand-hover': '#059669',
    '--color-accent': '#2dd4bf',
    '--text-main': '#ecfdf5',
    '--text-muted': '#94a3b8',
    '--border-main': '#1e3040',
    '--border-accent': '#10b981',
  },
  'sovereign-obsidian': {
    '--rgb-base': '14, 11, 8',
    '--rgb-sidebar': '23, 19, 14',
    '--rgb-card': '34, 28, 21',
    '--color-brand': '#f59e0b',
    '--color-brand-hover': '#d97706',
    '--color-accent': '#fbbf24',
    '--text-main': '#fef3c7',
    '--text-muted': '#a8a29e',
    '--border-main': '#3d2e1e',
    '--border-accent': '#f59e0b',
  },
  'sovereign-manifesto': {
    '--rgb-base': '245, 240, 232',
    '--rgb-sidebar': '234, 228, 216',
    '--rgb-card': '252, 251, 250',
    '--color-brand': '#d42b2b',
    '--color-brand-hover': '#b91c1c',
    '--color-accent': '#1a3dc4',
    '--text-main': '#0a0a0a',
    '--text-muted': '#525252',
    '--border-main': '#0a0a0a',
    '--border-accent': '#d42b2b',
  },
  'sovereign-light': {
    '--rgb-base': '248, 250, 252',
    '--rgb-sidebar': '241, 245, 249',
    '--rgb-card': '255, 255, 255',
    '--color-brand': '#2563eb',
    '--color-brand-hover': '#1d4ed8',
    '--color-accent': '#0ea5e9',
    '--text-main': '#0f172a',
    '--text-muted': '#64748b',
    '--border-main': '#cbd5e1',
    '--border-accent': '#2563eb',
  },
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
  const pauseOnMaximized = useStore(s => s.pauseOnMaximized) ?? true
  const togglePauseOnMaximized = useStore(s => s.togglePauseOnMaximized)
  const multiMonitorPauseMode = useStore(s => s.multiMonitorPauseMode) || 'per-display'
  const setMultiMonitorPauseMode = useStore(s => s.setMultiMonitorPauseMode)
  const audioPlaybackRule = useStore(s => s.audioPlaybackRule) || 'mute-covered'
  const setAudioPlaybackRule = useStore(s => s.setAudioPlaybackRule)
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

  // Auth store bindings
  const authUser = useStore(s => s.authUser)
  const isAuthenticated = useStore(s => s.isAuthenticated)
  const setShowAuthModal = useStore(s => s.setShowAuthModal)
  const clearAuth = useStore(s => s.clearAuth)
  const [signingOut, setSigningOut] = useState(false)

  // Custom Theme Studio & Import/Export State
  const [showCustomStudio, setShowCustomStudio] = useState(false)
  const [isLivePreviewing, setIsLivePreviewing] = useState(false)
  const [hasCustomized, setHasCustomized] = useState(false)
  const [customThemeName, setCustomThemeName] = useState('My Custom Theme')
  const [customTokens, setCustomTokens] = useState({ ...STARTER_PRESETS[0].tokens })
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false)
  const [themeToast, setThemeToast] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importJsonText, setImportJsonText] = useState('')
  const fileInputRef = useRef(null)

  const showToast = (type, text) => {
    setThemeToast({ type, text })
    setTimeout(() => setThemeToast(null), 3500)
  }

  // Helper to open the Studio cleanly without prematurely overriding the active theme
  const handleOpenStudio = () => {
    const currentTokens = customThemes[activeTheme] || BUILTIN_THEME_TOKENS[activeTheme] || STARTER_PRESETS[0].tokens
    const normalized = {}
    Object.entries(currentTokens).forEach(([k, v]) => {
      if (k.startsWith('--')) {
        normalized[k] = k.startsWith('--rgb-') ? rgbTupleToHex(v) : v
      }
    })
    setCustomTokens(normalized)
    setCustomThemeName(
      customThemes[activeTheme]?._meta?.name
        ? `${customThemes[activeTheme]._meta.name} (Custom)`
        : 'My Custom Theme'
    )
    setIsLivePreviewing(false)
    setHasCustomized(false)
    setShowCustomStudio(true)
  }

  // Live preview custom tokens ONLY when explicitly enabled or when user has customized
  useEffect(() => {
    if (!showCustomStudio || !isLivePreviewing) return
    Object.entries(customTokens).forEach(([k, val]) => {
      const finalVal = k.startsWith('--rgb-') ? hexToRgbTuple(val) : val
      document.documentElement.style.setProperty(k, finalVal)
    })
  }, [showCustomStudio, isLivePreviewing, customTokens])

  const handleTokenChange = (key, val) => {
    setCustomTokens(prev => ({ ...prev, [key]: val }))
    setHasCustomized(true)
    setIsLivePreviewing(true) // User actually customized: engage live preview!
  }

  const handleSelectPreset = (starter) => {
    setCustomTokens({ ...starter.tokens })
    setCustomThemeName(starter.name)
    setHasCustomized(true)
    setIsLivePreviewing(true) // User intentionally picked a starter preset
  }

  const handleToggleLivePreview = () => {
    if (isLivePreviewing) {
      setIsLivePreviewing(false)
      setActiveTheme(activeTheme) // Revert document inline styles to active theme
    } else {
      setIsLivePreviewing(true)
    }
  }

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
    setIsLivePreviewing(false)
    setHasCustomized(false)
    setSaveSuccessMsg(true)
    showToast('success', `Theme "${customThemeName.trim() || 'Custom Theme'}" saved and activated!`)
    setTimeout(() => setSaveSuccessMsg(false), 3500)
  }

  const handleCloseStudio = () => {
    setShowCustomStudio(false)
    setIsLivePreviewing(false)
    setHasCustomized(false)
    setActiveTheme(activeTheme) // Revert document inline styles to active theme
  }

  // Export theme as downloadable .json file
  const handleExportTheme = (themeId = null, themeTokens = null, themeName = null) => {
    try {
      let name = themeName
      let tokens = themeTokens

      if (!tokens) {
        const targetId = themeId || activeTheme
        if (customThemes[targetId]) {
          tokens = { ...customThemes[targetId] }
          name = tokens._meta?.name || 'Custom Theme'
          delete tokens._meta
        } else if (BUILTIN_THEME_TOKENS[targetId]) {
          tokens = BUILTIN_THEME_TOKENS[targetId]
          const builtin = BUILTIN_THEMES.find(t => t.id === targetId)
          name = builtin ? builtin.name : targetId
        } else if (showCustomStudio) {
          tokens = { ...customTokens }
          name = customThemeName || 'Custom Theme'
        }
      }

      if (!tokens) {
        showToast('error', 'No theme tokens available to export')
        return
      }

      const payload = {
        name: name || 'AetherFlow Theme',
        type: 'aetherflow-theme',
        version: 1,
        author: authUser?.user_metadata?.full_name || 'AetherFlow User',
        exportedAt: new Date().toISOString(),
        tokens: tokens,
      }

      const jsonStr = JSON.stringify(payload, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filename = `${(name || 'theme').toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.aetherflow-theme.json`
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showToast('success', `Exported "${name}" theme successfully!`)
    } catch (err) {
      console.error('Export theme error:', err)
      showToast('error', 'Failed to export theme')
    }
  }

  // Copy theme JSON to clipboard
  const handleCopyThemeJson = (themeId = null) => {
    try {
      const targetId = themeId || activeTheme
      const targetTheme = customThemes[targetId]
      const tokens = targetTheme ? { ...targetTheme } : (BUILTIN_THEME_TOKENS[targetId] || customTokens)
      const name = targetTheme?._meta?.name || BUILTIN_THEMES.find(t => t.id === targetId)?.name || customThemeName
      const cleanTokens = { ...tokens }
      if (cleanTokens._meta) delete cleanTokens._meta

      const payload = {
        name: name || 'AetherFlow Theme',
        type: 'aetherflow-theme',
        version: 1,
        tokens: cleanTokens,
      }
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      showToast('success', `Copied "${name}" theme JSON to clipboard!`)
    } catch (err) {
      showToast('error', 'Failed to copy to clipboard')
    }
  }

  // Process and import theme JSON object
  const processImportedTheme = (parsed) => {
    try {
      const tokens = parsed.tokens || parsed
      if (!tokens || typeof tokens !== 'object') {
        throw new Error('Invalid theme format: no tokens object found')
      }

      // Verify at least one essential token exists
      const hasBase = tokens['--rgb-base'] || tokens['base'] || tokens['--bg-base']
      const hasBrand = tokens['--color-brand'] || tokens['brand'] || tokens['accent']
      if (!hasBase && !hasBrand) {
        throw new Error('Missing essential color tokens (--rgb-base or --color-brand)')
      }

      // Normalize tokens
      const normalized = {}
      Object.entries(tokens).forEach(([k, v]) => {
        if (typeof v === 'string') {
          const key = k.startsWith('--') ? k : `--${k}`
          normalized[key] = key.startsWith('--rgb-') && v.startsWith('#') ? hexToRgbTuple(v) : v
        }
      })

      const themeName = parsed.name || 'Imported Theme'
      const id = `custom-imported-${Date.now()}`
      normalized._meta = {
        name: themeName,
        bg: normalized['--rgb-base'] ? (normalized['--rgb-base'].startsWith('#') ? normalized['--rgb-base'] : rgbTupleToHex(normalized['--rgb-base'])) : '#09090b',
        card: normalized['--rgb-card'] ? (normalized['--rgb-card'].startsWith('#') ? normalized['--rgb-card'] : rgbTupleToHex(normalized['--rgb-card'])) : '#1a1a20',
        accent: normalized['--color-brand'] || '#3b82f6',
        text: normalized['--text-main'] || '#fafafa',
      }

      saveCustomTheme(id, normalized)
      setActiveTheme(id)
      showToast('success', `Theme "${themeName}" imported and activated!`)
      setShowImportModal(false)
      setImportJsonText('')
    } catch (err) {
      console.error('Theme import error:', err)
      showToast('error', err.message || 'Failed to import theme JSON')
    }
  }

  // Handle file import from <input type="file">
  const handleFileImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        const parsed = JSON.parse(text)
        processImportedTheme(parsed)
      } catch (err) {
        showToast('error', 'Invalid JSON file: ' + err.message)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (err) {
      console.warn('Sign out error:', err)
    } finally {
      clearAuth()
      setSigningOut(false)
      showToast('success', 'Successfully signed out')
    }
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
  const preferredAudioMonitor = useStore(s => s.preferredAudioMonitor) || 'auto'
  const setPreferredAudioMonitor = useStore(s => s.setPreferredAudioMonitor)
  const [monitors, setMonitors] = useState([])

  useEffect(() => {
    let unlistenMonitors
    function loadMonitors() {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('get_monitors').then(res => {
          if (Array.isArray(res)) setMonitors(res)
        }).catch(() => {})
      }).catch(() => {})
    }
    loadMonitors()
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('aura:monitors-changed', () => loadMonitors()).then(u => { unlistenMonitors = u })
    }).catch(() => {})
    window.addEventListener('focus', loadMonitors)
    return () => {
      if (unlistenMonitors) unlistenMonitors()
      window.removeEventListener('focus', loadMonitors)
    }
  }, [])

  const [wallpaperDirectory, setWallpaperDirectory] = useState('')
  useEffect(() => {
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('get_wallpaper_directory').then(dir => {
        if (dir) setWallpaperDirectory(dir)
      }).catch(() => {})
    }).catch(() => {})
  }, [])

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

  const syncAllPerformance = (overrides = {}) => {
    const pBattery = overrides.pauseOnBattery !== undefined ? overrides.pauseOnBattery : pauseOnBattery
    const pFullscreen = overrides.pauseOnFullscreen !== undefined ? overrides.pauseOnFullscreen : pauseOnFullscreen
    const pMaximized = overrides.pauseOnMaximized !== undefined ? overrides.pauseOnMaximized : pauseOnMaximized
    const mMode = overrides.multiMonitorPauseMode !== undefined ? overrides.multiMonitorPauseMode : multiMonitorPauseMode
    const aRule = overrides.audioPlaybackRule !== undefined ? overrides.audioPlaybackRule : audioPlaybackRule
    const pAudioMon = overrides.preferredAudioMonitor !== undefined ? overrides.preferredAudioMonitor : preferredAudioMonitor
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('sync_performance_settings', {
        pauseOnBattery: pBattery,
        pauseOnFullscreen: pFullscreen,
        pauseOnMaximized: pMaximized,
        multiMonitorPauseMode: mMode,
        audioPlaybackRule: aRule,
        preferredAudioMonitor: pAudioMon === 'auto' ? null : pAudioMon,
      }).catch(() => {})
    }).catch(() => {})
  }

  const handleTogglePauseOnBattery = () => {
    const nextVal = !pauseOnBattery
    togglePauseOnBattery()
    syncAllPerformance({ pauseOnBattery: nextVal })
  }

  const handleTogglePauseOnFullscreen = () => {
    const nextVal = !pauseOnFullscreen
    togglePauseOnFullscreen()
    syncAllPerformance({ pauseOnFullscreen: nextVal })
  }

  const handleTogglePauseOnMaximized = () => {
    const nextVal = !pauseOnMaximized
    togglePauseOnMaximized()
    syncAllPerformance({ pauseOnMaximized: nextVal })
  }

  const handleMultiMonitorPauseModeChange = (mode) => {
    setMultiMonitorPauseMode(mode)
    syncAllPerformance({ multiMonitorPauseMode: mode })
  }

  const handleAudioPlaybackRuleChange = (rule) => {
    setAudioPlaybackRule(rule)
    syncAllPerformance({ audioPlaybackRule: rule })
  }

  const handlePreferredAudioMonitorChange = (monLabel) => {
    setPreferredAudioMonitor(monLabel)
    syncAllPerformance({ preferredAudioMonitor: monLabel })
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
    { id: 'account',     label: 'Account',     icon: User },
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

            <SettingRow
              label="Pause on Maximized Windows"
              desc="Suspend wallpaper rendering when standard desktop applications (Brave, Chrome, VS Code) are maximized to save power"
            >
              <label className="toggle">
                <input type="checkbox" checked={pauseOnMaximized} onChange={handleTogglePauseOnMaximized} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </SettingRow>

            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-main)' }}>
              <div className="text-sm font-semibold" style={{ marginBottom: 4 }}>Multi-Monitor Playback Behavior</div>
              <div className="text-xs text-muted" style={{ marginBottom: 12 }}>
                {multiMonitorPauseMode === 'per-display' 
                  ? 'Isolated (Per-Display): Only the monitor covered by a fullscreen or maximized window pauses. Other monitors continue animating.' 
                  : 'Global (All Displays): Pauses all monitors whenever any single monitor is covered by a fullscreen or maximized window.'}
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-item ${multiMonitorPauseMode === 'per-display' ? 'active-brand' : ''}`}
                  onClick={() => handleMultiMonitorPauseModeChange('per-display')}
                >
                  Isolated (Per-Display)
                </button>
                <button
                  type="button"
                  className={`segmented-item ${multiMonitorPauseMode === 'all-displays' ? 'active-brand' : ''}`}
                  onClick={() => handleMultiMonitorPauseModeChange('all-displays')}
                >
                  Global (All Displays)
                </button>
              </div>
            </div>

            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-main)' }}>
              <div className="text-sm font-semibold" style={{ marginBottom: 4 }}>Wallpaper Audio Playback Policy</div>
              <div className="text-xs text-muted" style={{ marginBottom: 12 }}>
                {audioPlaybackRule === 'mute-covered'
                  ? 'Mute When Covered: Automatically mutes wallpaper audio when your active screens are maximized or fullscreen.'
                  : audioPlaybackRule === 'mute-focused'
                  ? 'Mute When App Focused: Mutes wallpaper audio whenever any non-desktop application has keyboard/window focus.'
                  : 'Always Active: Keeps wallpaper audio playing continuously even when browsing or multitasking.'}
              </div>
              <div className="segmented-control" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <button
                  type="button"
                  className={`segmented-item ${audioPlaybackRule === 'mute-covered' ? 'active-brand' : ''}`}
                  onClick={() => handleAudioPlaybackRuleChange('mute-covered')}
                >
                  Mute When Covered
                </button>
                <button
                  type="button"
                  className={`segmented-item ${audioPlaybackRule === 'mute-focused' ? 'active-brand' : ''}`}
                  onClick={() => handleAudioPlaybackRuleChange('mute-focused')}
                >
                  Mute When Focused
                </button>
                <button
                  type="button"
                  className={`segmented-item ${audioPlaybackRule === 'always' ? 'active-brand' : ''}`}
                  onClick={() => handleAudioPlaybackRuleChange('always')}
                >
                  Always Active
                </button>
              </div>
            </div>

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
            <div className="setting-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="flex items-center gap-2.5">
                <Palette size={16} style={{ color: 'var(--color-accent)' }} />
                <span className="text-sm font-semibold">Sovereign Theme Presets</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleFileImport}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 11.5, padding: '4px 10px', height: 28 }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Import theme from a .json file"
                >
                  <FileUp size={13} /> Import
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 11.5, padding: '4px 10px', height: 28 }}
                  onClick={() => handleExportTheme()}
                  title="Export active theme as .json file"
                >
                  <FileDown size={13} /> Export Active
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: 11.5, padding: '4px 12px', height: 28 }}
                  onClick={() => {
                    if (showCustomStudio) {
                      handleCloseStudio()
                    } else {
                      handleOpenStudio()
                    }
                  }}
                >
                  <Plus size={13} /> {showCustomStudio ? 'Hide Studio' : 'Customize & Create'}
                </button>
              </div>
            </div>

            {themeToast && (
              <div
                className="flex items-center gap-2 animate-fadeIn"
                style={{
                  margin: '12px 18px 0',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  background: themeToast.type === 'error'
                    ? 'color-mix(in srgb, var(--color-rose) 15%, transparent)'
                    : 'color-mix(in srgb, var(--color-emerald) 15%, transparent)',
                  border: `1px solid ${themeToast.type === 'error' ? 'var(--color-rose)' : 'var(--color-emerald)'}`,
                  color: themeToast.type === 'error' ? 'var(--color-rose)' : 'var(--color-emerald)',
                }}
              >
                {themeToast.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                <span>{themeToast.text}</span>
              </div>
            )}

            <div style={{ padding: '16px 18px' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 14 }}>
                Select a visual identity, import a theme JSON, or create a custom palette. All UI surfaces, elevations, accents, and glows will dynamically adapt.
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
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isSelected && (
                            <span
                              style={{
                                width: 18, height: 18, borderRadius: '50%',
                                background: 'var(--color-brand)',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff'
                              }}
                            >
                              <Check size={11} strokeWidth={3} />
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn-icon"
                            style={{ padding: 4, color: 'var(--text-muted)' }}
                            title="Export theme JSON"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleExportTheme(id)
                            }}
                          >
                            <Download size={12} />
                          </button>
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
              <div className="setting-card-header" style={{ background: 'color-mix(in srgb, var(--color-brand) 8%, var(--bg-card))', flexWrap: 'wrap', gap: 8 }}>
                <div className="flex items-center gap-2.5">
                  <Paintbrush size={16} style={{ color: 'var(--color-brand)' }} />
                  <span className="text-sm font-semibold">Custom Theme Studio</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`badge ${isLivePreviewing ? 'badge-brand' : ''} font-mono`}
                    style={{ fontSize: 10 }}
                  >
                    {isLivePreviewing ? '⚡ Live Preview' : 'Draft Mode'}
                  </span>
                  <button
                    type="button"
                    className={`btn ${isLivePreviewing ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 11, padding: '3px 8px', height: 24 }}
                    onClick={handleToggleLivePreview}
                    title={isLivePreviewing ? 'Pause live preview and inspect default' : 'Engage live preview of your custom tweaks'}
                  >
                    <Eye size={12} /> {isLivePreviewing ? 'Preview ON' : 'Preview OFF'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '3px 8px', height: 24 }}
                    onClick={() => handleExportTheme(null, customTokens, customThemeName)}
                    title="Export current custom theme draft as JSON file"
                  >
                    <Download size={12} /> Export Draft
                  </button>
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
                {isLivePreviewing && (
                  <div
                    className="flex items-center gap-2 animate-fadeIn"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'color-mix(in srgb, var(--color-brand) 12%, transparent)',
                      border: '1px solid var(--color-brand)',
                      color: 'var(--color-brand)',
                      marginBottom: 16,
                      fontSize: 12,
                    }}
                  >
                    <Eye size={14} />
                    <span>Live Preview Active: UI changes reflect live across the window. Click <strong>Save & Apply</strong> to keep or <strong>Cancel & Reset</strong> to revert.</span>
                  </div>
                )}

                {saveSuccessMsg && (
                  <div
                    className="flex items-center gap-2 animate-fadeIn"
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
                          onClick={() => handleSelectPreset(starter)}
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
                  Theme Color Tokens ({isLivePreviewing ? 'Live Preview Active' : 'Draft'})
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
                            onChange={e => handleTokenChange(key, e.target.value)}
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12 }}
                      onClick={() => handleCopyThemeJson()}
                    >
                      <Copy size={13} /> Copy JSON
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

          {/* Card 2: Audio Output by Display (Multi-Monitor Audio Routing) */}
          <div className="setting-card" style={{ marginTop: 16 }}>
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <Volume2 size={16} style={{ color: 'var(--color-brand)' }} />
                <span className="text-sm font-semibold">Audio Output by Display</span>
              </div>
              <span className="badge font-mono" style={{ fontSize: 10 }}>
                {preferredAudioMonitor === 'auto'
                  ? 'Auto (Primary)'
                  : (monitors.find(m => m.label === preferredAudioMonitor)?.name || 'Custom Display')}
              </span>
            </div>

            <div style={{ padding: '16px 18px' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 14, lineHeight: 1.5 }}>
                Select which monitor's wallpaper outputs sound. In multi-monitor setups, other displays are automatically muted to prevent audio desync and echo.
              </div>

              {/* Output Mode Selector */}
              <div className="segmented-control" style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  className={`segmented-item ${preferredAudioMonitor === 'auto' ? 'active-brand' : ''}`}
                  onClick={() => handlePreferredAudioMonitorChange('auto')}
                >
                  Auto (Primary Screen)
                </button>
                <button
                  type="button"
                  className={`segmented-item ${preferredAudioMonitor !== 'auto' ? 'active-brand' : ''}`}
                  onClick={() => {
                    const first = monitors[0]?.label || 'wallpaper_0'
                    handlePreferredAudioMonitorChange(first)
                  }}
                >
                  Specific Display ({monitors.length > 1 ? `${monitors.length} Displays` : 'Per-Screen'})
                </button>
              </div>

              {/* Visual Interactive Displays */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`,
                gap: 12,
                marginBottom: 16,
              }}>
                {(monitors.length > 0 ? monitors : [
                  { label: 'wallpaper_0', name: '\\\\.\\DISPLAY1', width: 1920, height: 1080, isPrimary: true }
                ]).map((m, idx) => {
                  const isSelected = preferredAudioMonitor === 'auto'
                    ? (m.isPrimary || idx === 0)
                    : preferredAudioMonitor === m.label

                  return (
                    <div
                      key={m.label || idx}
                      onClick={() => handlePreferredAudioMonitorChange(m.label)}
                      className={`option-card ${isSelected ? 'selected' : ''}`}
                      style={{
                        padding: '14px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 100,
                        position: 'relative',
                        background: isSelected
                          ? 'color-mix(in srgb, var(--color-brand) 12%, var(--bg-card))'
                          : 'var(--bg-card)',
                        borderColor: isSelected ? 'var(--color-brand)' : 'var(--border-subtle)',
                        boxShadow: isSelected ? '0 0 16px -4px var(--color-brand)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Monitor size={14} style={{ color: isSelected ? 'var(--color-brand)' : 'var(--text-muted)' }} />
                          <span className="font-semibold text-xs" style={{ color: isSelected ? 'var(--color-brand)' : 'var(--text-main)' }}>
                            Display {idx + 1}
                          </span>
                        </div>
                        {m.isPrimary && (
                          <span className="badge" style={{ fontSize: 9, padding: '1px 5px' }}>Primary</span>
                        )}
                      </div>

                      <div style={{ margin: '10px 0' }}>
                        <div className="text-xs font-mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                          {m.width} × {m.height}
                        </div>
                        <div className="text-xs text-muted" style={{ fontSize: 10, marginTop: 2 }}>
                          {m.name || m.label}
                        </div>
                      </div>

                      <div className="flex items-center justify-between" style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 10.5, color: isSelected ? 'var(--color-brand)' : 'var(--text-muted)', fontWeight: isSelected ? 600 : 400 }}>
                          {isSelected ? 'Sound Active' : 'Muted'}
                        </span>
                        {isSelected ? (
                          <span
                            style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: 'var(--color-brand)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff',
                            }}
                            title="Active sound emitter"
                          >
                            <Volume2 size={12} strokeWidth={2.5} />
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>
                            <VolumeX size={14} />
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Lively Feature: Play audio only when desktop is focused */}
              <div className="flex items-center justify-between" style={{
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                marginBottom: 12,
              }}>
                <div className="flex flex-col">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>
                    Play audio only when desktop is focused
                  </span>
                  <span className="text-xs text-muted" style={{ fontSize: 10.5, marginTop: 2 }}>
                    Mutes wallpaper audio as soon as another window or game is active
                  </span>
                </div>
                <label className="toggle" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={audioPlaybackRule === 'mute-focused'}
                    onChange={() => {
                      const nextRule = audioPlaybackRule === 'mute-focused' ? 'mute-covered' : 'mute-focused'
                      handleAudioPlaybackRuleChange(nextRule)
                    }}
                  />
                  <div className="toggle-track" />
                  <div className="toggle-thumb" />
                </label>
              </div>

              {/* Audio Playback Policy Segments */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted" style={{ marginBottom: 6 }}>
                  Audio Playback Policy
                </div>
                <div className="segmented-control" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  <button
                    type="button"
                    className={`segmented-item ${audioPlaybackRule === 'mute-covered' ? 'active-brand' : ''}`}
                    onClick={() => handleAudioPlaybackRuleChange('mute-covered')}
                  >
                    Mute When Covered
                  </button>
                  <button
                    type="button"
                    className={`segmented-item ${audioPlaybackRule === 'mute-focused' ? 'active-brand' : ''}`}
                    onClick={() => handleAudioPlaybackRuleChange('mute-focused')}
                  >
                    Mute When Focused
                  </button>
                  <button
                    type="button"
                    className={`segmented-item ${audioPlaybackRule === 'always' ? 'active-brand' : ''}`}
                    onClick={() => handleAudioPlaybackRuleChange('always')}
                  >
                    Always Active
                  </button>
                </div>
              </div>
            </div>
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

          {/* Wallpaper Storage Card */}
          <div className="setting-card">
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <FolderOpen size={16} style={{ color: 'var(--color-brand)' }} />
                <span className="text-sm font-semibold">Wallpaper Library Storage</span>
              </div>
              <span className="badge font-mono" style={{ fontSize: 10 }}>Self-Contained</span>
            </div>

            <div style={{ padding: '16px 18px' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 14, lineHeight: 1.5 }}>
                Imported video and image wallpapers are automatically stored inside your isolated AetherFlow library folder. You can safely delete or relocate original files from your Downloads or Desktop without affecting your active wallpapers.
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-subtle)',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <Folder size={16} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
                  <span className="font-mono text-xs text-muted" style={{ wordBreak: 'break-all', userSelect: 'all' }}>
                    {wallpaperDirectory || 'Loading library path…'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '4px 10px', height: 28 }}
                    onClick={() => {
                      if (wallpaperDirectory) {
                        navigator.clipboard?.writeText?.(wallpaperDirectory)
                        showToast('success', 'Library path copied to clipboard')
                      }
                    }}
                    title="Copy path to clipboard"
                  >
                    <Copy size={12} /> Copy
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 11, padding: '4px 12px', height: 28, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      import('@tauri-apps/api/core').then(({ invoke }) => {
                        invoke('open_wallpaper_directory').catch(() => {})
                      }).catch(() => {})
                    }}
                  >
                    <ExternalLink size={12} /> Open Folder
                  </button>
                </div>
              </div>
            </div>
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

      {/* ── Tab 7: Account & Identity ────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <div className="animate-fadeIn">
          {isAuthenticated && authUser ? (
            /* Authenticated User Profile */
            <div className="setting-card">
              <div className="setting-card-header">
                <div className="flex items-center gap-2.5">
                  <User size={16} style={{ color: 'var(--color-brand)' }} />
                  <span className="text-sm font-semibold">Account Profile & Community Identity</span>
                </div>
                <span className="badge badge-emerald font-mono" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-emerald)', display: 'inline-block' }} />
                  Connected
                </span>
              </div>

              <div style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <UserAvatar user={authUser} size={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-bold text-lg" style={{ color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
                      {authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.user_name || 'AetherFlow Creator'}
                    </div>
                    <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                      {authUser.email || 'Connected Account'}
                    </div>
                    <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
                      <span className="badge" style={{ fontSize: 10 }}>
                        {(() => {
                          const meta = authUser?.user_metadata || {}
                          const appMeta = authUser?.app_metadata || {}
                          const identities = authUser?.identities || []
                          const hasGoogle = meta.iss?.includes('google') || appMeta.provider === 'google' || identities.some(i => i.provider === 'google')
                          const hasGitHub = meta.iss?.includes('github') || appMeta.provider === 'github' || identities.some(i => i.provider === 'github')
                          if (hasGoogle && hasGitHub) return 'Google + GitHub Linked'
                          if (hasGoogle) return 'Google Account'
                          if (hasGitHub) return 'GitHub Account'
                          return 'Verified Creator'
                        })()}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost font-mono"
                        style={{ fontSize: 10, padding: '2px 8px', height: 'auto', color: 'var(--text-muted)' }}
                        onClick={() => {
                          navigator.clipboard.writeText(authUser.id || '')
                          showToast('success', 'Copied User ID to clipboard')
                        }}
                        title="Copy User ID"
                      >
                        <Copy size={10} style={{ marginRight: 4 }} />
                        ID: {(authUser.id || '').substring(0, 8)}…
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>Community Sync</div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                      Your custom wallpaper submissions, marketplace likes, and installed packages are synced to this account.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      fontSize: 12,
                      color: 'var(--color-rose)',
                      border: '1px solid color-mix(in srgb, var(--color-rose) 30%, transparent)',
                      background: 'color-mix(in srgb, var(--color-rose) 8%, transparent)',
                    }}
                    onClick={handleSignOut}
                    disabled={signingOut}
                  >
                    <LogOut size={13} style={{ marginRight: 6 }} />
                    {signingOut ? 'Signing out…' : 'Sign Out'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Guest / Unauthenticated View */
            <div className="setting-card">
              <div className="setting-card-header">
                <div className="flex items-center gap-2.5">
                  <Shield size={16} style={{ color: 'var(--color-brand)' }} />
                  <span className="text-sm font-semibold">Account & Community Access</span>
                </div>
                <span className="badge" style={{ fontSize: 10 }}>Guest Mode</span>
              </div>

              <div style={{ padding: '24px 22px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 18px',
                  borderRadius: 12,
                  background: 'color-mix(in srgb, var(--border-main) 20%, var(--bg-card))',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: 20
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'color-mix(in srgb, var(--color-brand) 15%, transparent)',
                    border: '1px solid var(--color-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-brand)',
                    flexShrink: 0
                  }}>
                    <User size={22} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--text-main)' }}>
                      You are currently using AetherFlow in Offline Guest Mode
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: 3, lineHeight: 1.45 }}>
                      All core functionality (Canvas 2D engines, MPV videos, local pictures, web streams, and taskbar styling) operates completely offline without an account.
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted" style={{ marginBottom: 12 }}>
                    Why connect an account?
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-brand)', marginBottom: 4 }}>
                        <Upload size={14} /> Publish Wallpapers
                      </div>
                      <div className="text-xs text-muted" style={{ lineHeight: 1.4 }}>
                        Share your animated videos, audio visualizers, and interactive canvases to the Community Marketplace.
                      </div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-accent)', marginBottom: 4 }}>
                        <Cloud size={14} /> Cloud Bookmarks
                      </div>
                      <div className="text-xs text-muted" style={{ lineHeight: 1.4 }}>
                        Sync your liked wallpapers, favorites list, and creator profile across all your Windows PCs.
                      </div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-emerald)', marginBottom: 4 }}>
                        <ShieldCheck size={14} /> Creator Reputation
                      </div>
                      <div className="text-xs text-muted" style={{ lineHeight: 1.4 }}>
                        Track your community download counts, receive likes, and earn verified creator status.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 13, padding: '9px 24px' }}
                    onClick={() => setShowAuthModal(true)}
                  >
                    <LogIn size={15} style={{ marginRight: 6 }} /> Sign In / Create Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cloud Infrastructure & Local Storage Card */}
          <div className="setting-card" style={{ marginTop: 18 }}>
            <div className="setting-card-header">
              <div className="flex items-center gap-2.5">
                <Globe size={16} style={{ color: 'var(--color-accent)' }} />
                <span className="text-sm font-semibold">Backend Infrastructure & Diagnostics</span>
              </div>
              <span className="badge font-mono" style={{ fontSize: 10 }}>Cloud Status</span>
            </div>

            <SettingRow
              label="Supabase Cloud Connectivity"
              desc="Required for Community Marketplace browsing, publishing, and OAuth session synchronization"
            >
              <span
                className={`badge ${isOnline() ? 'badge-emerald' : ''}`}
                style={{
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: isOnline() ? 'var(--color-emerald)' : 'var(--text-muted)'
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: isOnline() ? 'var(--color-emerald)' : 'var(--text-muted)'
                  }}
                />
                {isOnline() ? 'Online · Connected' : 'Offline / Standalone Mode'}
              </span>
            </SettingRow>

            <SettingRow
              label="Local Storage & Data Persistence"
              desc="Installed wallpapers, customized themes, audio presets, and favorites are safely stored on disk"
            >
              <span className="telemetry-chip font-mono">
                Persisted (LocalStorage)
              </span>
            </SettingRow>
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
