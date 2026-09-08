import React from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Home, Store, Library, Settings, Zap } from 'lucide-react'
import { useStore, syncCustomWallpapersFromDisk } from './store/useStore.js'
import { applyWallpaperToDesktop } from './lib/wallpaperActions.js'
import StatusBar from './components/StatusBar/index.jsx'
import HomePage from './pages/Home.jsx'
import MarketplacePage from './pages/Marketplace.jsx'
import LibraryPage from './pages/Library.jsx'
import SettingsPage from './pages/Settings.jsx'

// NOTE: WallpaperPlayer is NO LONGER rendered in the control panel.
// The canvas lives in a completely separate window (wallpaper.html / wallpaper.jsx)
// that is pinned into the Windows WorkerW desktop layer via the PROGMAN trick.
// The control panel communicates with it via Tauri IPC (invoke → Rust → emit).

const NAV = [
  { to: '/',           icon: Home,    label: 'Home'        },
  { to: '/marketplace', icon: Store,  label: 'Marketplace' },
  { to: '/library',    icon: Library, label: 'Library'     },
  { to: '/settings',   icon: Settings,label: 'Settings'    },
]

export default function App() {
  const sidebarCollapsed = useStore(s => s.sidebarCollapsed)
  const toggleSidebar    = useStore(s => s.toggleSidebar)
  const audioVolume      = useStore(s => s.audioVolume)
  const audioMuted       = useStore(s => s.audioMuted)
  const pauseOnBattery   = useStore(s => s.pauseOnBattery)
  const pauseOnFullscreen = useStore(s => s.pauseOnFullscreen)

  // Broadcast global volume/mute changes to all active wallpaper windows & MPV
  React.useEffect(() => {
    async function broadcastAudio() {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('set_mpv_volume', { monitorLabel: null, volume: audioVolume }).catch(() => {})
        await invoke('set_mpv_mute', { monitorLabel: null, muted: audioMuted }).catch(() => {})
        await invoke('update_wallpaper_config', { 
          config: { volume: audioVolume, muted: audioMuted },
          monitorLabel: null // broadcast to all
        }).catch(() => {})
      } catch (err) {
        // Not in Tauri
      }
    }
    broadcastAudio()
  }, [audioVolume, audioMuted])

  // Sync battery & fullscreen power management settings with native Rust monitor
  React.useEffect(() => {
    async function syncPerformance() {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('sync_performance_settings', {
          pauseOnBattery: !!pauseOnBattery,
          pauseOnFullscreen: !!pauseOnFullscreen,
        }).catch(() => {})
      } catch (err) {}
    }
    syncPerformance()
  }, [pauseOnBattery, pauseOnFullscreen])

  // Ensure window is visible and focused on mount unless launched minimized at startup
  React.useEffect(() => {
    async function initWindow() {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const isMinimized = await invoke('is_minimized_boot').catch(() => false)
        if (!isMinimized) {
          const { getCurrentWindow } = await import('@tauri-apps/api/window')
          const win = getCurrentWindow()
          await win.show()
          await win.setFocus()
        }
      } catch {}
    }
    initWindow()
  }, [])

  // Auto-restore wallpaper & sync custom wallpapers on startup/cold boot
  React.useEffect(() => {
    let timer = null
    async function restoreStartup() {
      try {
        await syncCustomWallpapersFromDisk()
        const state = useStore.getState()
        if (state.isWallpaperRunning) {
          timer = setTimeout(async () => {
            if (state.screenArrangement === 'per-screen' && state.monitorWallpapers && Object.keys(state.monitorWallpapers).length > 0) {
              console.log('[AetherFlow] Restoring per-screen wallpapers on startup:', state.monitorWallpapers)
              for (const [monLabel, wp] of Object.entries(state.monitorWallpapers)) {
                if (wp) {
                  await applyWallpaperToDesktop(wp, { targetMonitor: monLabel })
                }
              }
            } else if (state.activeWallpaper) {
              console.log('[AetherFlow] Restoring active wallpaper on startup:', state.activeWallpaper)
              await applyWallpaperToDesktop(state.activeWallpaper)
            }
          }, 600)
        }
      } catch (e) {
        console.error('[AetherFlow] Startup restoration failed:', e)
      }
    }
    restoreStartup()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <BrowserRouter>
      {/* Control panel shell — pure UI, no wallpaper canvas here */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: sidebarCollapsed ? '60px 1fr' : '200px 1fr',
        gridTemplateRows: '1fr auto',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-base)',
        transition: 'grid-template-columns 0.25s var(--ease-smooth)',
      }}>
        {/* Sidebar */}
        <aside style={{
          background: 'var(--bg-sidebar)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--border-main)',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 8px',
          gridRow: '1 / 3',
          overflow: 'hidden',
        }}>
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 8px 20px',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'var(--color-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px color-mix(in srgb, var(--color-brand) 50%, transparent)',
            }}>
              <Zap size={16} color="#fff" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-display font-bold text-lg" style={{ letterSpacing: '-0.5px' }}>
                AetherFlow
              </span>
            )}
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'} style={{ textDecoration: 'none' }}>
                {({ isActive }) => (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 10px',
                    borderRadius: 8,
                    color: isActive ? 'var(--color-brand)' : 'var(--text-muted)',
                    background: isActive ? 'color-mix(in srgb, var(--color-brand) 12%, transparent)' : 'transparent',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-main)' }}}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}}
                  >
                    <Icon size={17} style={{ flexShrink: 0 }} />
                    {!sidebarCollapsed && <span className="text-sm font-medium">{label}</span>}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main style={{
          overflow: 'auto',
          background: 'var(--bg-base)',
          padding: '24px',
        }}>
          <Routes>
            <Route path="/"            element={<HomePage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/library"     element={<LibraryPage />} />
            <Route path="/settings"    element={<SettingsPage />} />
          </Routes>
        </main>

        {/* Status bar */}
        <StatusBar />
      </div>
    </BrowserRouter>
  )
}
