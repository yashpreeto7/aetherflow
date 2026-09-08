import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { Monitor, Zap, Battery, Mic, Power, Layers, Activity, RefreshCw } from 'lucide-react'

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
  const [memData, setMemData] = useState(null)
  const [trimming, setTrimming] = useState(false)

  useEffect(() => {
    let active = true
    let timer
    async function fetchMem() {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const res = await invoke('get_detailed_memory_usage')
        if (active && res) setMemData(res)
      } catch {}
    }
    fetchMem()
    timer = setInterval(fetchMem, 2000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  async function handleTrim() {
    setTrimming(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('trim_memory')
      const res = await invoke('get_detailed_memory_usage')
      if (res) setMemData(res)
    } catch {}
    setTimeout(() => setTrimming(false), 500)
  }

  const fps = useStore(s => s.fps)
  const setFps = useStore(s => s.setFps)
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

  const sections = [
    {
      icon: Activity, title: 'Resource & Memory Monitor',
      content: (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
              <div className="text-xs text-muted">Total Suite RAM</div>
              <div className="text-xl font-bold font-mono" style={{ color: 'var(--color-brand)', marginTop: 4 }}>
                {memData ? `${memData.total_mb} MB` : 'Loading…'}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
              <div className="text-xs text-muted">App Shell</div>
              <div className="text-base font-semibold font-mono" style={{ marginTop: 4 }}>
                {memData ? `${memData.host_mb} MB` : '—'}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
              <div className="text-xs text-muted">UI & Graphics</div>
              <div className="text-base font-semibold font-mono" style={{ marginTop: 4 }}>
                {memData ? `${memData.webview_mb} MB` : '—'}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-main)' }}>
              <div className="text-xs text-muted">Video Engine (MPV)</div>
              <div className="text-base font-semibold font-mono" style={{ marginTop: 4 }}>
                {memData ? `${memData.mpv_mb} MB` : '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between" style={{ padding: '8px 0' }}>
            <span className="text-xs text-muted">All child processes (Host, WebView2, and MPV) are managed under a Windows Job Object.</span>
            <button
              className="btn btn-ghost"
              onClick={handleTrim}
              disabled={trimming}
              style={{ fontSize: 11, padding: '5px 12px', height: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={12} className={trimming ? 'animate-spin' : ''} />
              {trimming ? 'Compacting…' : 'Trim Working Set'}
            </button>
          </div>
        </div>
      ),
    },
    {
      icon: Monitor, title: 'Performance',
      content: (
        <>
          <SliderRow label="FPS Cap" value={fps} set={setFps} min={10} max={120} step={10} fmt={v => v === 120 ? 'Unlimited' : `${v} FPS`} />
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
        AetherFlow v1.0.0 · MIT License · Built with Tauri + React
      </div>
    </div>
  )
}
