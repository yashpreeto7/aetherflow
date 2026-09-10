import React from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Home, Store, Library, Settings, Zap, Sparkles, X as CloseIcon, LogOut, User, ChevronUp, LogIn } from 'lucide-react'
import { checkForUpdate } from './lib/updater.js'
import { useStore, syncCustomWallpapersFromDisk } from './store/useStore.js'
import { applyWallpaperToDesktop, safeListen, isTauri } from './lib/wallpaperActions.js'
import { supabase, onAuthStateChange, signOut } from './lib/supabase.js'
import AuthModal from './components/AuthModal/index.jsx'
import UserAvatar from './components/UserAvatar/index.jsx'
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
  const authUser         = useStore(s => s.authUser)
  const isAuthenticated  = useStore(s => s.isAuthenticated)
  const setAuthUser      = useStore(s => s.setAuthUser)
  const clearAuth        = useStore(s => s.clearAuth)
  const setShowAuthModal = useStore(s => s.setShowAuthModal)
  const [updateToast, setUpdateToast] = React.useState(null)
  const [showUserMenu, setShowUserMenu] = React.useState(false)
  const [signingOut, setSigningOut] = React.useState(false)
  const userMenuRef = React.useRef(null)

  // Close user menu on outside click
  React.useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await signOut()
      clearAuth()
      setShowUserMenu(false)
      await syncCustomWallpapersFromDisk()
    } catch (err) {
      console.error('Sign out error:', err)
      clearAuth()
      setShowUserMenu(false)
      await syncCustomWallpapersFromDisk()
    } finally {
      setSigningOut(false)
    }
  }

  // Listen for native OAuth popup callback from Tauri backend
  React.useEffect(() => {
    let unlisten
    safeListen('aura:oauth-callback', async (event) => {
      const urlStr = event.payload
      if (!urlStr) return
      console.log('[AetherFlow] Intercepted OAuth callback URL:', urlStr)
      try {
        const hashIdx = urlStr.indexOf('#')
        const queryIdx = urlStr.indexOf('?')

        const searchStr = queryIdx !== -1 ? (hashIdx > queryIdx ? urlStr.substring(queryIdx + 1, hashIdx) : urlStr.substring(queryIdx + 1)) : ''
        const hashStr = hashIdx !== -1 ? urlStr.substring(hashIdx + 1) : ''

        const searchParams = new URLSearchParams(searchStr)
        const hashParams = new URLSearchParams(hashStr)

        const accessToken = hashParams.get('access_token') || searchParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token')
        const code = searchParams.get('code') || hashParams.get('code')
        const errorMsg = searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error')

        if (errorMsg) {
          console.warn('[AetherFlow] OAuth callback returned error:', errorMsg)
          return
        }

        if (accessToken && supabase) {
          const { data } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })
          if (data?.session?.user) {
            setAuthUser(data.session.user, data.session)
            setShowAuthModal(false)
            await syncCustomWallpapersFromDisk()
          }
        } else if (code && supabase) {
          const { data } = await supabase.auth.exchangeCodeForSession(code)
          if (data?.session?.user) {
            setAuthUser(data.session.user, data.session)
            setShowAuthModal(false)
            await syncCustomWallpapersFromDisk()
          }
        }
      } catch (err) {
        console.error('[AetherFlow] Error handling OAuth callback:', err)
      }
    }).then(u => { unlisten = u }).catch(() => {})

    return () => {
      if (unlisten) unlisten()
    }
  }, [setAuthUser, setShowAuthModal])

  // Listen for Supabase auth state changes (login, logout, token refresh)
  React.useEffect(() => {
    const unsubscribe = onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAuthUser(session.user, session)
        setShowAuthModal(false)
        await syncCustomWallpapersFromDisk()
      } else if (event === 'SIGNED_OUT') {
        clearAuth()
      }
    })
    return unsubscribe
  }, [setAuthUser, clearAuth, setShowAuthModal])

  // One-time startup check for newer AetherFlow releases
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await checkForUpdate()
      if (res && res.hasUpdate) {
        setUpdateToast(res)
      }
    }, 3500)
    return () => clearTimeout(timer)
  }, [])

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
          await win.unminimize().catch(() => {})
          await win.show().catch(() => {})
          await win.setFocus().catch(() => {})
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
            if (isTauri()) {
              const { getCurrentWindow } = await import('@tauri-apps/api/window')
              const win = getCurrentWindow()
              await win.unminimize().catch(() => {})
              await win.show().catch(() => {})
              await win.setFocus().catch(() => {})
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
          overflow: 'visible',
          zIndex: 50,
          position: 'relative',
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
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
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

          {/* User profile / sign-in */}
          <div ref={userMenuRef} style={{
            position: 'relative',
            padding: '8px',
            borderTop: '1px solid var(--border-main)',
            marginTop: 'auto',
          }}>
            {isAuthenticated && authUser ? (
              <>
                {/* Account Menu Popover */}
                {showUserMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: sidebarCollapsed ? 'calc(100% + 8px)' : 8,
                    right: sidebarCollapsed ? 'auto' : 8,
                    width: sidebarCollapsed ? 230 : 'auto',
                    boxSizing: 'border-box',
                    background: 'var(--bg-card)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 12,
                    padding: '12px',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    zIndex: 1000,
                  }}>
                    {/* User header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <UserAvatar user={authUser} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.user_name || 'User'}
                        </div>
                        <div style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {authUser.email || ''}
                        </div>
                      </div>
                    </div>

                    {/* Provider badge */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 8px',
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-main)',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      marginBottom: 12,
                    }}>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--color-brand)',
                      }} />
                      {(() => {
                        const meta = authUser?.user_metadata || {}
                        const appMeta = authUser?.app_metadata || {}
                        const identities = authUser?.identities || []
                        const hasGoogle = meta.iss?.includes('google') || appMeta.provider === 'google' || identities.some(i => i.provider === 'google')
                        const hasGitHub = meta.iss?.includes('github') || appMeta.provider === 'github' || identities.some(i => i.provider === 'github')
                        if (hasGoogle && hasGitHub) return 'Google + GitHub Linked'
                        if (hasGoogle) return 'Google Account'
                        if (hasGitHub) return 'GitHub Account'
                        return 'Connected Account'
                      })()}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-main)', marginBottom: 10 }} />

                    {/* Sign Out button */}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: signingOut ? 'wait' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => { if (!signingOut) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)' }}
                      onMouseLeave={e => { if (!signingOut) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)' }}
                    >
                      <LogOut size={13} />
                      <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>
                    </button>
                  </div>
                )}

                {/* User Pill (Click to open menu) */}
                <button
                  type="button"
                  onClick={() => setShowUserMenu(v => !v)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 8,
                    background: showUserMenu ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    border: '1px solid',
                    borderColor: showUserMenu ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
                    outline: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { if (!showUserMenu) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)' }}
                  onMouseLeave={e => { if (!showUserMenu) e.currentTarget.style.background = 'transparent' }}
                  title="Account settings & Sign out"
                >
                  <UserAvatar user={authUser} size={28} />
                  {!sidebarCollapsed && (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-xs font-semibold" style={{
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          color: 'var(--text-main)',
                        }}>
                          {authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.user_metadata?.user_name || 'User'}
                        </div>
                        <div className="text-xs text-subtle" style={{
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          fontSize: 10,
                        }}>
                          {authUser.email || ''}
                        </div>
                      </div>
                      <ChevronUp size={13} style={{
                        color: 'var(--text-muted)',
                        transform: showUserMenu ? 'rotate(0deg)' : 'rotate(180deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                      }} />
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: 'color-mix(in srgb, var(--color-brand) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-brand) 25%, transparent)',
                  color: 'var(--color-brand)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--color-brand) 20%, transparent)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--color-brand) 12%, transparent)' }}
                title="Sign in to AetherFlow"
              >
                <LogIn size={15} />
                {!sidebarCollapsed && <span>Sign In</span>}
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main style={{
          overflow: 'auto',
          background: 'var(--bg-base)',
          padding: '24px',
        }}>
          {!isTauri() && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 16px',
              marginBottom: 20,
              borderRadius: 10,
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: '#93c5fd',
              fontSize: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>🌐</span>
                <span>
                  <strong>Web Preview Mode (Browser):</strong> Wallpapers preview in the browser. To set live animated wallpapers on your Windows desktop and customize the Taskbar, run <strong>AetherFlow.exe</strong>.
                </span>
              </div>
            </div>
          )}

          <Routes>
            <Route path="/"            element={<HomePage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/library"     element={<LibraryPage />} />
            <Route path="/settings"    element={<SettingsPage />} />
          </Routes>
        </main>

        {/* Status bar */}
        <StatusBar />

        {/* Floating Update Notification Toast */}
        {updateToast && (
          <div style={{
            position: 'fixed',
            bottom: 38,
            right: 20,
            zIndex: 9999,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-accent)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backdropFilter: 'blur(16px)',
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'color-mix(in srgb, var(--color-brand) 20%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Sparkles size={16} className="text-brand" />
            </div>
            <div>
              <div className="text-xs font-bold" style={{ color: 'var(--text-main)' }}>
                New Version Available: {updateToast.latestTag}
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                Enhancements and new features are ready to install.
              </div>
            </div>
            <div className="flex items-center gap-2" style={{ marginLeft: 8 }}>
              <NavLink to="/settings" style={{ textDecoration: 'none' }} onClick={() => setUpdateToast(null)}>
                <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px', height: 'auto' }}>
                  Update
                </button>
              </NavLink>
              <button className="btn-icon" onClick={() => setUpdateToast(null)} title="Dismiss">
                <CloseIcon size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Auth Modal (rendered at root so it floats above everything) */}
        <AuthModal />
      </div>
    </BrowserRouter>
  )
}
