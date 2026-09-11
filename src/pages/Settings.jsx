import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import {
  Monitor, Zap, Battery, Mic, Power, Layers, RefreshCw,
  LayoutTemplate, DownloadCloud, CheckCircle2, AlertCircle, ExternalLink, Sparkles, Eye
} from 'lucide-react'
import { checkForUpdate, openReleaseUrl, APP_VERSION } from '../lib/updater.js'

function SliderRow({ label, value, set, min, max, step, fmt }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="flex justify-between text-sm" style={{ marginBottom: 8 }}>
        <span className="font-medium">{label}</span>
        <span className="font-mono text-brand text-sm">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" className="slider" min={min} max={max} step={step}
        value={value} onChange={e => set(parseFloat(e.target.value))} />
    </div>
  )
}

function ToggleRow({ label, desc, value, toggle }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-main)' }}>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted" style={{ marginTop: 2 }}>{desc}</div>}
      </div>
      <label className="toggle" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={value} onChange={toggle} />
        <div className="toggle-track" />
        <div className="toggle-thumb" />
      </label>
    </div>
  )
}

export default function SettingsPage() {

  const fps = useStore(s => s.fps)
  const setFps = useStore(s => s.setFps)
  const taskbarStyle = useStore(s => s.taskbarStyle) || 'default'
  const setTaskbarStyle = useStore(s => s.setTaskbarStyle)
  const taskbarBorder = useStore(s => s.taskbarBorder) || false
  const setTaskbarBorder = useStore(s => s.setTaskbarBorder)
  const translucentTbInstalled = useStore(s => s.translucentTbInstalled)
  const translucentTbRunning = useStore(s => s.translucentTbRunning)
  const syncTaskbarState = useStore(s => s.syncTaskbarState)
  const restartTaskbar = useStore(s => s.restartTaskbar)
  const [restartingTaskbar, setRestartingTaskbar] = useState(false)

  useEffect(() => {
    syncTaskbarState?.().catch(() => {})
  }, [syncTaskbarState])

  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateResult, setUpdateResult] = useState(null)

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    setUpdateResult(null)
    const result = await checkForUpdate()
    setUpdateResult(result)
    setCheckingUpdate(false)
  }

  const handleFpsChange = (v) => {
    setFps(v)
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('update_wallpaper_config', { config: { fps: v }, monitorLabel: null }).catch(() => {})
    }).catch(() => {})
  }

  const autoStart = useStore(s => s.autoStart)
  const runInTray = useStore(s => s.runInTray)

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
      console.warn('[AetherFlow] Native autostart command failed, trying plugin fallback:', err)
      try {
        const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart')
        if (nextVal) {
          await enable()
        } else {
          await disable()
        }
        const verified = await isEnabled()
        useStore.setState({ autoStart: verified })
      } catch (pluginErr) {
        console.warn('[AetherFlow] Autostart plugin failed:', pluginErr)
      }
    }
  }

  const toggleRunInTray = useStore(s => s.toggleRunInTray)
  const pauseOnBattery = useStore(s => s.pauseOnBattery)
  const togglePauseOnBattery = useStore(s => s.togglePauseOnBattery)
  const pauseOnFullscreen = useStore(s => s.pauseOnFullscreen)
  const togglePauseOnFullscreen = useStore(s => s.togglePauseOnFullscreen)

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

  const audioReactive = useStore(s => s.audioReactive)
  const toggleAudioReactive = useStore(s => s.toggleAudioReactive)
  const audioSource = useStore(s => s.audioSource)
  const setAudioSource = useStore(s => s.setAudioSource)
  const audioVolume = useStore(s => s.audioVolume)
  const setAudioVolume = useStore(s => s.setAudioVolume)
  const audioMuted = useStore(s => s.audioMuted)
  const toggleAudioMuted = useStore(s => s.toggleAudioMuted)

  const handleVolumeChange = (v) => {
    setAudioVolume(v)
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('set_mpv_volume', { monitorLabel: null, volume: v }).catch(() => {})
      invoke('update_wallpaper_config', { config: { volume: v }, monitorLabel: null }).catch(() => {})
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
  const screenArrangement = useStore(s => s.screenArrangement)
  const setScreenArrangement = useStore(s => s.setScreenArrangement)
  const cardOpacity = useStore(s => s.cardOpacity)
  const setCardOpacity = useStore(s => s.setCardOpacity)
  const cardBlur = useStore(s => s.cardBlur)
  const setCardBlur = useStore(s => s.setCardBlur)
  const sidebarOpacity = useStore(s => s.sidebarOpacity)
  const setSidebarOpacity = useStore(s => s.setSidebarOpacity)
  const thumbnailMode = useStore(s => s.thumbnailMode) || 'hover'
  const setThumbnailMode = useStore(s => s.setThumbnailMode)

  const sections = [
    {
      icon: Monitor, title: 'Performance',
      content: (
        <>
          <SliderRow label="FPS Cap" value={fps} set={handleFpsChange} min={10} max={120} step={10} fmt={v => v === 120 ? 'Unlimited' : `${v} FPS`} />
          <ToggleRow label="Pause on Battery" desc="Saves power when unplugged" value={pauseOnBattery} toggle={handleTogglePauseOnBattery} />
          <ToggleRow label="Pause on Fullscreen Apps" desc="Hides wallpaper when playing games" value={pauseOnFullscreen} toggle={handleTogglePauseOnFullscreen} />
          
          <div style={{ marginTop: 16 }}>
            <div className="text-sm font-medium" style={{ marginBottom: 10 }}>Screen Arrangement</div>
            <div className="flex gap-2">
              {['duplicate', 'per-screen'].map(mode => (
                <button key={mode} className={`btn ${screenArrangement === mode ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setScreenArrangement(mode)} style={{ textTransform: 'capitalize' }}>
                  {mode === 'duplicate' ? 'Duplicate All' : 'Distinct (Per-Screen)'}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 8 }}>
              {screenArrangement === 'duplicate' 
                ? 'The active wallpaper applies to all connected monitors.' 
                : 'Select different wallpapers for each monitor from the Home tab.'}
            </div>
          </div>
        </>
      ),
    },
    {
      icon: Eye, title: 'Card Thumbnails & Previews',
      content: (
        <div>
          <div className="text-sm font-medium" style={{ marginBottom: 6 }}>Thumbnail Presentation Mode</div>
          <div className="text-xs text-muted" style={{ marginBottom: 14 }}>
            Control how wallpaper cards render previews across Home and Library screens.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[
              { id: 'always', label: 'Always On', desc: 'Always shows full image and video poster frames' },
              { id: 'hover', label: 'On Hover', desc: 'Zero-RAM vector badges; plays preview when hovered' },
              { id: 'off', label: 'Off', desc: 'Clean vector badges only; zero video/media decoders' },
            ].map(m => (
              <button
                key={m.id}
                className={`card card-interactive ${thumbnailMode === m.id ? 'card-active' : ''}`}
                style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: thumbnailMode === m.id ? '1px solid var(--color-brand)' : '1px solid var(--border-main)',
                  background: thumbnailMode === m.id ? 'rgba(var(--rgb-card), 0.9)' : 'var(--bg-card)',
                }}
                onClick={() => setThumbnailMode(m.id)}
              >
                <div className="font-semibold text-sm" style={{ color: thumbnailMode === m.id ? 'var(--color-brand)' : 'var(--text-main)', marginBottom: 4 }}>
                  {m.label}
                </div>
                <div className="text-xs text-muted" style={{ lineHeight: 1.4 }}>
                  {m.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: Mic, title: 'Audio (Video Wallpapers)',
      content: (
        <>
          <SliderRow label="Global Volume" value={audioVolume} set={handleVolumeChange} min={0} max={100} step={1} fmt={v => `${v}%`} />
          <ToggleRow label="Mute All Wallpapers" desc="Silences all active video wallpapers" value={audioMuted} toggle={handleMuteToggle} />
          <ToggleRow label="Audio Reactive Mode" desc="Wallpapers pulse to audio input" value={audioReactive} toggle={toggleAudioReactive} />
          {audioReactive && (
            <div style={{ marginTop: 16 }}>
              <div className="text-sm font-medium" style={{ marginBottom: 10 }}>Reactive Audio Source</div>
              <div className="flex gap-2">
                {['mic', 'system'].map(src => (
                  <button key={src} className={`btn ${audioSource === src ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setAudioSource(src)} style={{ textTransform: 'capitalize' }}>
                    {src === 'mic' ? 'Microphone' : 'System Audio'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ),
    },
    {
      icon: Layers, title: 'Glassmorphism',
      content: (
        <>
          <SliderRow label="Card Opacity" value={cardOpacity} set={v => { setCardOpacity(v); document.documentElement.style.setProperty('--card-opacity', v) }} min={0.2} max={1} step={0.05} fmt={v => `${Math.round(v * 100)}%`} />
          <SliderRow label="Blur Intensity" value={cardBlur} set={v => { setCardBlur(v); document.documentElement.style.setProperty('--card-blur', `${v}px`) }} min={0} max={32} step={2} fmt={v => `${v}px`} />
          <SliderRow label="Sidebar Opacity" value={sidebarOpacity} set={v => { setSidebarOpacity(v); document.documentElement.style.setProperty('--sidebar-opacity', v) }} min={0.2} max={1} step={0.05} fmt={v => `${Math.round(v * 100)}%`} />
        </>
      ),
    },
    {
      icon: Power, title: 'System',
      content: (
        <>
          <ToggleRow label="Launch at Startup" desc="Start AetherFlow when Windows boots" value={autoStart} toggle={handleToggleAutoStart} />
          <ToggleRow label="Minimize to Tray" desc="Keep running in system tray when closed" value={runInTray} toggle={toggleRunInTray} />
        </>
      ),
    },
    {
      icon: LayoutTemplate, title: 'Windows Taskbar Styling',
      content: (
        <div>
          <div className="text-sm font-medium" style={{ marginBottom: 6 }}>Taskbar Appearance</div>
          <div className="text-xs text-muted" style={{ marginBottom: 14 }}>
            Apply high-performance native transparency or frosted glass to Windows taskbars on all connected displays.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {[
              { id: 'default', label: 'Default', desc: 'Windows standard style' },
              { id: 'clear', label: 'Clear', desc: '100% transparent glass' },
              { id: 'acrylic', label: 'Acrylic', desc: 'Frosted acrylic blur' },
              { id: 'blur', label: 'Blur', desc: 'Soft Gaussian blur' },
            ].map(style => {
              const active = taskbarStyle === style.id
              return (
                <button
                  key={style.id}
                  className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    height: 'auto',
                    textAlign: 'left',
                    borderRadius: 8,
                    border: active ? '1px solid var(--color-brand)' : '1px solid var(--border-main)',
                  }}
                  onClick={() => setTaskbarStyle(style.id)}
                >
                  <div className="text-sm font-semibold flex items-center justify-between w-full">
                    <span>{style.label}</span>
                    {active && <CheckCircle2 size={13} />}
                  </div>
                  <div className="text-xs" style={{ opacity: 0.75, marginTop: 4, fontWeight: 400 }}>
                    {style.desc}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Border Option */}
          <div className="flex items-center justify-between" style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <div>
              <div className="text-sm font-medium">Taskbar Top Border</div>
              <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                {taskbarBorder ? 'Showing top border separator line' : 'Clean borderless edge (No border)'}
              </div>
            </div>
            <button
              className={`btn ${taskbarBorder ? 'btn-ghost' : 'btn-primary'}`}
              style={{ fontSize: 12, padding: '6px 14px', height: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setTaskbarBorder(!taskbarBorder)}
            >
              {!taskbarBorder && <CheckCircle2 size={13} />}
              {taskbarBorder ? 'Border: Visible' : 'No Border'}
            </button>
          </div>

          <div className="text-xs text-muted" style={{ marginTop: 12, opacity: 0.9, lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <div className="flex items-center gap-2">
                <strong>TranslucentTB Engine:</strong>
                <span className={`badge ${translucentTbInstalled && translucentTbRunning ? 'badge-brand' : translucentTbInstalled ? 'badge-amber' : 'badge-ghost'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                  {translucentTbInstalled && translucentTbRunning ? 'Active & Synced' : translucentTbInstalled ? 'Installed (Stopped)' : 'Not Installed'}
                </span>
              </div>
              <button
                className="btn btn-ghost"
                disabled={restartingTaskbar}
                style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-main)', borderRadius: 6 }}
                onClick={async () => {
                  setRestartingTaskbar(true)
                  await restartTaskbar()
                  setTimeout(() => setRestartingTaskbar(false), 1200)
                }}
              >
                <RefreshCw size={11} className={restartingTaskbar ? 'animate-spin' : ''} />
                {restartingTaskbar ? 'Recovering...' : 'Fix / Recover Taskbar'}
              </button>
            </div>
            <div style={{ marginBottom: translucentTbInstalled ? 0 : 8 }}>
              💡 When TranslucentTB is installed, AetherFlow controls it directly, keeps your taskbar transparent, and prevents XAML conflicts. Switching styles takes effect instantly.
            </div>
            {!translucentTbInstalled && (
              <button
                className="btn btn-ghost"
                style={{ padding: '5px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-main)', borderRadius: 6, marginTop: 6 }}
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
      ),
    },
    {
      icon: DownloadCloud, title: 'Software Updates',
      content: (
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                <span>Installed Version</span>
                <span className="badge font-mono badge-brand">v{APP_VERSION}</span>
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                Official GitHub releases and automated installer updates
              </div>
            </div>
            <button
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
              borderRadius: 8,
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
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '5px 12px', height: 'auto' }}
                      onClick={() => openReleaseUrl(updateResult.releaseUrl)}
                    >
                      <ExternalLink size={12} style={{ marginRight: 4 }} /> View on GitHub
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '5px 14px', height: 'auto' }}
                      onClick={() => openReleaseUrl(updateResult.downloadUrl)}
                    >
                      <DownloadCloud size={13} style={{ marginRight: 6 }} /> Download Update
                    </button>
                  </div>
                </div>
              ) : updateResult.error ? (
                <div className="flex items-center gap-2 text-xs text-rose" style={{ color: 'var(--color-rose)' }}>
                  <AlertCircle size={14} />
                  <span>Unable to check updates: {updateResult.error}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald" style={{ color: 'var(--color-emerald)' }}>
                  <CheckCircle2 size={14} />
                  <span>You are running the latest version of AetherFlow (v{APP_VERSION})</span>
                </div>
              )}
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="font-display font-bold text-2xl" style={{ letterSpacing: '-0.5px' }}>Settings</h1>
        <p className="text-muted text-sm" style={{ marginTop: 4 }}>Configure AetherFlow performance and behavior</p>
      </div>

      {sections.map(({ icon: Icon, title, content }) => (
        <div key={title} className="card p-4" style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'color-mix(in srgb, var(--color-brand) 15%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={15} style={{ color: 'var(--color-brand)' }} />
            </div>
            <h2 className="font-semibold text-base">{title}</h2>
          </div>
          {content}
        </div>
      ))}

      <div className="text-xs text-muted" style={{ textAlign: 'center', marginTop: 20, paddingBottom: 20 }}>
        AetherFlow v{APP_VERSION} · MIT License · Built with Tauri + React
      </div>
    </div>
  )
}
