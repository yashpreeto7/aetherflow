import React, { useEffect, useState } from 'react'
import { Zap, Palette, Cpu, Mic, Settings, ChevronLeft, Square } from 'lucide-react'
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

  // Live FPS counter
  const [fps, setFps] = useState(0)
  useEffect(() => {
    let frames = 0
    let last = performance.now()
    let animId
    function count() {
      frames++
      const now = performance.now()
      if (now - last >= 1000) {
        setFps(frames)
        frames = 0
        last = now
      }
      animId = requestAnimationFrame(count)
    }
    animId = requestAnimationFrame(count)
    return () => cancelAnimationFrame(animId)
  }, [])

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
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      background: 'var(--bg-sidebar)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border-main)',
      fontSize: 11,
      color: 'var(--text-muted)',
      userSelect: 'none',
      zIndex: 10,
    }}>
      {/* Left */}
      <div className="flex items-center gap-4">
        <button className="btn-icon" onClick={toggleSidebar} style={{ padding: 4 }}>
          <ChevronLeft size={13} style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>

        <div className="flex items-center gap-2">
          <Zap size={11} style={{ color: 'var(--color-brand)' }} />
          <span>{activeWallpaper?.name ?? 'No wallpaper selected'}</span>
        </div>

        <div className="flex items-center gap-2">
          <Palette size={11} style={{ color: 'var(--color-accent)' }} />
          <span style={{ textTransform: 'capitalize' }}>{themeLabel}</span>
        </div>
      </div>

      {/* Center — Universal Desktop Status & Stop Button */}
      <div className="flex items-center gap-3">
        {isWallpaperRunning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#34d399', fontWeight: 600 }}>
              <span className="status-dot-live" />
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
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#fca5a5',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Stop wallpaper running on desktop"
            >
              <Square size={10} fill="#fca5a5" />
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
      <div className="flex items-center gap-4">
        {audioReactive && (
          <div className="flex items-center gap-2" style={{ color: 'var(--color-emerald)' }}>
            <Mic size={11} />
            <span>Audio reactive</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Cpu size={11} />
          <span className="font-mono">{fps} fps</span>
        </div>

        <button className="btn-icon" onClick={() => navigate('/settings')} style={{ padding: 4 }}>
          <Settings size={13} />
        </button>
      </div>
    </div>
  )
}
