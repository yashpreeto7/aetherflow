import React, { useEffect, useState } from 'react'
import { Zap, Palette, Mic, Settings, ChevronLeft, Square, Activity } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { stopDesktopWallpaper } from '../../lib/wallpaperActions.js'
import { useNavigate } from 'react-router-dom'

export default function StatusBar() {
  const activeWallpaper    = useStore(s => s.activeWallpaper)
  const isWallpaperRunning = useStore(s => s.isWallpaperRunning)
  const activeTheme        = useStore(s => s.activeTheme)
  const audioReactive      = useStore(s => s.audioReactive)
  const sidebarCollapsed   = useStore(s => s.sidebarCollapsed)
  const toggleSidebar      = useStore(s => s.toggleSidebar)
  const navigate           = useNavigate()
  const [stopping, setStopping] = useState(false)
  const [memUsage, setMemUsage] = useState(null)
  const [trimming, setTrimming] = useState(false)

  // Live memory polling (every 2.5s)
  useEffect(() => {
    let active = true
    let timer
    async function fetchMem() {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const data = await invoke('get_detailed_memory_usage')
        if (active && data) setMemUsage(data)
      } catch {}
    }
    fetchMem()
    timer = setInterval(fetchMem, 2500)
    return () => { active = false; clearInterval(timer) }
  }, [])

  async function handleTrim(e) {
    e.stopPropagation()
    setTrimming(true)
    try {
      // 1. Purge any detached or dormant media elements in the browser DOM
      document.querySelectorAll('video').forEach(v => {
        if (v.paused && !document.body.contains(v)) {
          try {
            v.pause()
            v.removeAttribute('src')
            v.load()
          } catch {}
        }
      })

      // 2. Trigger V8 garbage collection if available
      if (typeof window !== 'undefined' && window.gc) {
        try { window.gc() } catch {}
      }

      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('trim_memory')

      // Let the OS commit page trimming before re-reading memory
      await new Promise(r => setTimeout(r, 150))
      const data = await invoke('get_detailed_memory_usage')
      if (data) setMemUsage(data)
    } catch {}
    setTimeout(() => setTrimming(false), 500)
  }

  const themeLabel = activeTheme?.replace('sovereign-', '').replace('-', ' ') ?? '—'

  async function handleStop(e) {
    e.stopPropagation()
    setStopping(true)
    try {
      await stopDesktopWallpaper()
    } finally {
      setStopping(false)
    }
  }

  return (
    <div style={{
      gridColumn: '2 / 3',
      height: 38,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 18px',
      background: 'var(--bg-sidebar)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderTop: '1px solid var(--border-subtle)',
      boxShadow: 'var(--bevel-highlight)',
      fontSize: 11,
      color: 'var(--text-muted)',
      userSelect: 'none',
      zIndex: 10,
    }}>
      {/* Left */}
      <div className="flex items-center gap-3">
        <button className="btn-icon" onClick={toggleSidebar} style={{ padding: 4, borderRadius: 6 }}>
          <ChevronLeft size={13} style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 9px',
            borderRadius: 6,
            background: 'color-mix(in srgb, var(--text-main) 4%, transparent)',
            border: '1px solid var(--border-subtle)',
          }}
          title={`Active Wallpaper: ${activeWallpaper?.name ?? 'None'}`}
        >
          <Zap size={11} style={{ color: 'var(--color-brand)' }} />
          <span style={{ fontWeight: 500, color: 'var(--text-main)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeWallpaper?.name ?? 'No wallpaper selected'}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 9px',
            borderRadius: 6,
            background: 'color-mix(in srgb, var(--text-main) 4%, transparent)',
            border: '1px solid var(--border-subtle)',
          }}
          title={`Current Theme: ${themeLabel}`}
        >
          <Palette size={11} style={{ color: 'var(--color-accent)' }} />
          <span style={{ textTransform: 'capitalize', fontWeight: 500, color: 'var(--text-muted)' }}>{themeLabel}</span>
        </div>
      </div>

      {/* Center — Universal Desktop Status & Stop Button */}
      <div className="flex items-center gap-3">
        {isWallpaperRunning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--color-emerald)',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}>
              <span className="status-dot-live" style={{ boxShadow: '0 0 10px rgba(16, 185, 129, 0.6)' }} />
              Live on Desktop
            </span>
            <button
              onClick={handleStop}
              disabled={stopping}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 12px',
                height: 24,
                fontSize: 11,
                fontWeight: 600,
                background: 'color-mix(in srgb, var(--color-rose) 14%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-rose) 40%, transparent)',
                color: 'var(--color-rose)',
                borderRadius: 6,
                cursor: 'pointer',
                boxShadow: 'var(--surface-bevel)',
                transition: 'all 0.15s ease',
              }}
              title="Stop wallpaper running on desktop"
            >
              <Square size={10} fill="currentColor" />
              {stopping ? 'Stopping…' : 'Stop Wallpaper'}
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-subtle)', opacity: 0.4 }} />
            Desktop Idle
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {audioReactive && (
          <div className="flex items-center gap-2" style={{ color: 'var(--color-emerald)', fontSize: 11 }}>
            <Mic size={11} />
            <span>Audio reactive</span>
          </div>
        )}

        {memUsage && (
          <div
            className="flex items-center gap-1.5"
            onClick={handleTrim}
            title={`AetherFlow Total Suite Memory: ${memUsage.total_mb} MB\n• Main App: ${memUsage.host_mb} MB\n• UI & Graphics (WebView2): ${memUsage.webview_mb} MB\n• Video Player (MPV): ${memUsage.mpv_mb} MB\n\nClick to Trim / Compact Memory`}
            style={{
              cursor: 'pointer',
              padding: '3px 9px',
              borderRadius: 6,
              background: 'color-mix(in srgb, var(--text-main) 4%, transparent)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--surface-bevel)',
              fontSize: 10.5,
              fontWeight: 600,
              color: memUsage.total_mb > 350 ? 'var(--color-amber)' : 'var(--text-main)',
              transition: 'all 0.18s ease',
            }}
          >
            <Activity size={10} style={{ color: 'var(--color-brand)' }} />
            <span className="font-mono">{trimming ? 'Trimming…' : `${memUsage.total_mb} MB`}</span>
          </div>
        )}

        <button className="btn-icon" onClick={() => navigate('/settings')} style={{ padding: 4, borderRadius: 6 }} title="AetherFlow Settings">
          <Settings size={13} />
        </button>
      </div>
    </div>
  )
}
