import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Legacy Storage Migration & Cleanup ─────────────────────────────────────
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const aether = localStorage.getItem('aetherflow-state')
    const aura = localStorage.getItem('auraos-state')
    if (!aether && aura) {
      localStorage.setItem('aetherflow-state', aura)
    } else if (aether) {
      try {
        const parsed = JSON.parse(aether)
        if (parsed?.state?.authSession) {
          delete parsed.state.authSession
        }
        if (parsed?.state?.homeWallpaperIds) {
          parsed.state.homeWallpaperIds = parsed.state.homeWallpaperIds.filter(id => !id.startsWith('community-'))
        }
        localStorage.setItem('aetherflow-state', JSON.stringify(parsed))
      } catch (e) {
        console.warn('[Store] Recovered corrupted aetherflow-state in localStorage')
      }
    }
  }
} catch {
  // ignore
}

async function persistCustomWallpapersToDisk(installed) {
  try {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      const { invoke } = await import('@tauri-apps/api/core')
      const customs = (installed || []).filter(i => i.isCustom || i.engine === 'video-player' || i.engine === 'image-player')
      await invoke('save_custom_wallpapers', { wallpapers: customs })
    }
  } catch {
    // ignore
  }
}

export async function syncCustomWallpapersFromDisk() {
  try {
    let diskItems = []
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      const { invoke } = await import('@tauri-apps/api/core')
      diskItems = await invoke('load_custom_wallpapers')
    } else {
      // Browser dev environment: load custom wallpapers from Vite dev endpoint
      try {
        const res = await fetch('/api/custom-wallpapers')
        if (res.ok) {
          diskItems = await res.json()
        }
      } catch {}
    }

    if (Array.isArray(diskItems) && diskItems.length > 0) {
      const state = useStore.getState()
      const currentInstalled = state.installed || []
      const currentMap = new Map(currentInstalled.map(i => [i.id, i]))

      // Ensure all disk items are present in installed with isCustom flag
      for (const item of diskItems) {
        currentMap.set(item.id, {
          ...(currentMap.get(item.id) || {}),
          ...item,
          isCustom: true,
        })
      }

      const merged = Array.from(currentMap.values())
      const homeList = state.homeWallpaperIds || []
      // Never force community marketplace wallpapers into Home on sync
      const homeIds = new Set(homeList.filter(id => !id.startsWith('community-')))

      useStore.setState({
        installed: merged,
        homeWallpaperIds: Array.from(homeIds)
      })
      console.log(`[Store] Synced ${diskItems.length} custom wallpapers from disk. Total pinned to Home: ${homeIds.size}`)
    }
  } catch (err) {
    console.warn('[Store] syncCustomWallpapersFromDisk error:', err)
  }
}

/**
 * AuraOS Global State (Zustand)
 * Persisted to localStorage so settings survive restarts.
 */
export const useStore = create(
  persist(
    (set, get) => ({
      // ── Active Wallpaper (UI Preview / Selection) ──────────────────────
      activeWallpaper: null,          // { id, name, engine, config } — previewed/selected in UI
      currentDesktopWallpaper: null,  // { id, name, engine, config } — actually running on desktop
      wallpaperOpacity: 1,
      wallpaperBrightness: 0.85,
      wallpaperSpeed: 1,              // Global speed multiplier

      // Multi-Monitor & Audio
      screenArrangement: 'duplicate', // 'duplicate' | 'per-screen'
      monitorWallpapers: {},          // { [monitorLabel]: activeWallpaperObject }
      audioVolume: 50,                // 0 to 100
      audioMuted: false,

      // ── Screensaver Settings (Lively v2.1 Enhancements) ───────────────────
      screensaverEnabled: false,
      screensaverTimeoutMins: 5,
      screensaverMode: 'current', // 'current' | 'random' | 'specific' | 'blackout'
      screensaverSpecificEngine: null,
      screensaverFadeInSecs: 1.0,
      screensaverLockOnResume: false,
      screensaverGracePeriodSecs: 5,
      screensaverMuteAudio: true,

      setScreensaverEnabled: (v) => set({ screensaverEnabled: v }),
      toggleScreensaverEnabled: () => set((s) => ({ screensaverEnabled: !s.screensaverEnabled })),
      setScreensaverTimeoutMins: (v) => set({ screensaverTimeoutMins: v }),
      setScreensaverMode: (v) => set({ screensaverMode: v }),
      setScreensaverSpecificEngine: (v) => set({ screensaverSpecificEngine: v }),
      setScreensaverFadeInSecs: (v) => set({ screensaverFadeInSecs: v }),
      setScreensaverLockOnResume: (v) => set({ screensaverLockOnResume: v }),
      toggleScreensaverLockOnResume: () => set((s) => ({ screensaverLockOnResume: !s.screensaverLockOnResume })),
      setScreensaverGracePeriodSecs: (v) => set({ screensaverGracePeriodSecs: v }),
      setScreensaverMuteAudio: (v) => set({ screensaverMuteAudio: v }),
      toggleScreensaverMuteAudio: () => set((s) => ({ screensaverMuteAudio: !s.screensaverMuteAudio })),

      // Card thumbnail presentation mode: 'always' | 'hover' | 'off'
      thumbnailMode: 'hover',
      setThumbnailMode: (mode) => set({ thumbnailMode: mode }),

      // Per-wallpaper adhered audio settings: { [wallpaperId]: { volume: number, muted: boolean } }
      wallpaperAudioSettings: {},
      setWallpaperAudio: (id, audioUpdates) => set((s) => {
        const prev = s.wallpaperAudioSettings?.[id] || { volume: s.audioVolume, muted: s.audioMuted }
        const next = { ...prev, ...audioUpdates }
        const nextAudioMap = { ...(s.wallpaperAudioSettings || {}), [id]: next }

        // Also sync into activeWallpaper and currentDesktopWallpaper if they match this id
        const activeWallpaper = s.activeWallpaper?.id === id
          ? { ...s.activeWallpaper, config: { ...(s.activeWallpaper.config || {}), ...next } }
          : s.activeWallpaper
        const currentDesktopWallpaper = s.currentDesktopWallpaper?.id === id
          ? { ...s.currentDesktopWallpaper, config: { ...(s.currentDesktopWallpaper.config || {}), ...next } }
          : s.currentDesktopWallpaper

        // If in installed array, also keep config in sync
        const installed = (s.installed || []).map(item =>
          item.id === id ? { ...item, config: { ...(item.config || {}), ...next } } : item
        )

        return {
          wallpaperAudioSettings: nextAudioMap,
          activeWallpaper,
          currentDesktopWallpaper,
          installed,
        }
      }),

      setScreenArrangement: (v) => set({ screenArrangement: v }),
      setMonitorWallpaper: (label, wp) => set((s) => ({
        monitorWallpapers: { ...s.monitorWallpapers, [label]: wp }
      })),
      clearMonitorWallpapers: () => set({ monitorWallpapers: {}, currentDesktopWallpaper: null }),
      setAudioVolume: (v) => set({ audioVolume: v }),
      toggleAudioMuted: () => set((s) => ({ audioMuted: !s.audioMuted })),

      // isWallpaperRunning = true when the canvas is LIVE on the Windows desktop
      // (pinned into WorkerW via PROGMAN trick). Not the same as just being selected.
      isWallpaperRunning: false,

      setActiveWallpaper: (wallpaper) => set((s) => {
        if (!wallpaper) return { activeWallpaper: null }
        // Merge any adhered audio settings for this specific wallpaper
        const adhered = s.wallpaperAudioSettings?.[wallpaper.id]
        const mergedConfig = {
          ...(wallpaper.config || {}),
          ...(adhered ? { volume: adhered.volume, muted: adhered.muted } : {})
        }
        return {
          activeWallpaper: {
            ...wallpaper,
            config: mergedConfig,
          }
        }
      }),
      setCurrentDesktopWallpaper: (wallpaper) => set({ currentDesktopWallpaper: wallpaper }),
      setWallpaperRunning: (v) => set({ isWallpaperRunning: v }),
      setWallpaperOpacity: (v) => set({ wallpaperOpacity: v }),
      setWallpaperBrightness: (v) => set({ wallpaperBrightness: v }),
      setWallpaperSpeed: (v) => set({ wallpaperSpeed: v }),
      updateWallpaperConfig: (updates) => set((s) => {
        const activeWpId = s.activeWallpaper?.id
        let nextAudioMap = s.wallpaperAudioSettings || {}
        if (activeWpId && (updates.volume !== undefined || updates.muted !== undefined)) {
          const prevAudio = nextAudioMap[activeWpId] || { volume: s.audioVolume, muted: s.audioMuted }
          nextAudioMap = {
            ...nextAudioMap,
            [activeWpId]: {
              volume: updates.volume !== undefined ? updates.volume : prevAudio.volume,
              muted: updates.muted !== undefined ? updates.muted : prevAudio.muted,
            }
          }
        }
        return {
          wallpaperAudioSettings: nextAudioMap,
          activeWallpaper: s.activeWallpaper 
            ? { ...s.activeWallpaper, config: { ...s.activeWallpaper.config, ...updates } }
            : null,
          currentDesktopWallpaper: s.currentDesktopWallpaper
            ? { ...s.currentDesktopWallpaper, config: { ...s.currentDesktopWallpaper.config, ...updates } }
            : null
        }
      }),

      // ── Active Theme ──────────────────────────────────────────────────────
      activeTheme: 'sovereign-onyx',
      themes: {},                      // user-saved custom themes

      setActiveTheme: (id) => {
        set({ activeTheme: id })
        document.documentElement.setAttribute('data-theme', id)
        
        // If it's a custom theme, apply its tokens as inline styles
        const customThemes = get().themes;
        if (customThemes && customThemes[id]) {
          const tokens = customThemes[id];
          Object.entries(tokens).forEach(([key, value]) => {
            if (key.startsWith('--')) {
              document.documentElement.style.setProperty(key, value);
            }
          });
        } else {
          // Clear any custom inline styles if switching to a built-in theme
          document.documentElement.removeAttribute('style');
        }

        // Always ensure glow ambience multiplier is active
        const val = get().glowAmbience || 'balanced';
        const mult = val === 'vivid' ? '1.5' : val === 'balanced' ? '1' : val === 'subtle' ? '0.4' : '0';
        document.documentElement.style.setProperty('--glow-multiplier', mult);
      },
      saveCustomTheme: (id, tokens) =>
        set((s) => ({ themes: { ...s.themes, [id]: tokens } })),

      // ── Visual Ambience & Motion ─────────────────────────────────────────
      glowAmbience: 'balanced', // 'vivid' | 'balanced' | 'subtle' | 'off'
      setGlowAmbience: (val) => {
        set({ glowAmbience: val })
        if (typeof document !== 'undefined') {
          const mult = val === 'vivid' ? '1.5' : val === 'balanced' ? '1' : val === 'subtle' ? '0.4' : '0'
          document.documentElement.style.setProperty('--glow-multiplier', mult)
        }
      },
      reducedMotion: false,
      toggleReducedMotion: () => set((s) => {
        const next = !s.reducedMotion
        if (typeof document !== 'undefined') {
          if (next) document.documentElement.classList.add('reduced-motion')
          else document.documentElement.classList.remove('reduced-motion')
        }
        return { reducedMotion: next }
      }),

      // ── Library (installed wallpapers & themes) ──────────────────────────
      installed: [],                   // [{ id, type, name, engine, config, installedAt }]
      homeWallpaperIds: [              // IDs of wallpapers curated for Home screen
        'fps-meter', 'matrix-rain', 'cyber-particles', 'synthwave-grid',
        'deep-space', 'tokyo-rain', 'aurora', 'audio-spectrum'
      ],
      customNames: {},                 // { [id]: string } user-edited wallpaper names

      installItem: (item) =>
        set((s) => {
          const installed = [...s.installed.filter(i => i.id !== item.id), item]
          persistCustomWallpapersToDisk(installed)
          return { installed }
        }),
      uninstallItem: (id) =>
        set((s) => {
          const installed = (s.installed || []).filter(i => i.id !== id)
          if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
            import('@tauri-apps/api/core').then(({ invoke }) => {
              invoke('delete_custom_wallpaper', { id }).catch(() => {})
            }).catch(() => {})
          }
          return {
            installed,
            homeWallpaperIds: (s.homeWallpaperIds || []).filter(x => x !== id),
          }
        }),

      // ── Home Curation (Pin / Unpin) ──────────────────────────────────────
      togglePinToHome: (id) => set((s) => {
        const list = s.homeWallpaperIds || []
        return {
          homeWallpaperIds: list.includes(id) ? list.filter(x => x !== id) : [...list, id]
        }
      }),
      pinToHome: (id) => set((s) => ({
        homeWallpaperIds: (s.homeWallpaperIds || []).includes(id) ? s.homeWallpaperIds : [...(s.homeWallpaperIds || []), id]
      })),
      unpinFromHome: (id) => set((s) => ({
        homeWallpaperIds: (s.homeWallpaperIds || []).filter(x => x !== id)
      })),

      // ── Liked Wallpapers (Local Favorites) ──────────────────────────────
      likedWallpaperIds: [],
      toggleLikeWallpaper: (id) => set((s) => {
        const list = s.likedWallpaperIds || []
        const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
        return { likedWallpaperIds: next }
      }),

      // ── Delete Custom Theme ─────────────────────────────────────────────
      deleteCustomTheme: (id) => set((s) => {
        const next = { ...(s.themes || {}) }
        delete next[id]
        const activeTheme = s.activeTheme === id ? 'sovereign-onyx' : s.activeTheme
        if (s.activeTheme === id) {
          document.documentElement.setAttribute('data-theme', 'sovereign-onyx')
          document.documentElement.removeAttribute('style')
          const val = s.glowAmbience || 'balanced'
          const mult = val === 'vivid' ? '1.5' : val === 'balanced' ? '1' : val === 'subtle' ? '0.4' : '0'
          document.documentElement.style.setProperty('--glow-multiplier', mult)
        }
        return { themes: next, activeTheme }
      }),

      // ── Renaming ──────────────────────────────────────────────────────────
      setWallpaperName: (id, newName) => set((s) => {
        const customNames = { ...(s.customNames || {}), [id]: newName }
        const installed = (s.installed || []).map(item =>
          item.id === id ? { ...item, name: newName } : item
        )
        persistCustomWallpapersToDisk(installed)
        const activeWallpaper = s.activeWallpaper?.id === id
          ? { ...s.activeWallpaper, name: newName }
          : s.activeWallpaper
        const currentDesktopWallpaper = s.currentDesktopWallpaper?.id === id
          ? { ...s.currentDesktopWallpaper, name: newName }
          : s.currentDesktopWallpaper
        return { customNames, installed, activeWallpaper, currentDesktopWallpaper }
      }),

      // ── Settings ──────────────────────────────────────────────────────────
      autoStart: false,
      runInTray: true,
      pauseOnBattery: true,
      pauseOnFullscreen: true,
      pauseOnMaximized: true,
      multiMonitorPauseMode: 'per-display', // 'per-display' | 'all-displays'
      audioPlaybackRule: 'mute-covered',    // 'mute-covered' | 'mute-focused' | 'always'
      preferredAudioMonitor: 'auto',        // 'auto' | specific monitor label (e.g. 'wallpaper_DISPLAY1')
      audioReactive: false,
      audioSource: 'mic',             // 'mic' | 'system'
      fps: 60,                        // Target FPS cap
      taskbarStyle: 'default',        // 'default' | 'clear' | 'acrylic' | 'blur'
      taskbarBorder: false,           // false = no border / clean glass, true = show top line
      translucentTbInstalled: true,
      translucentTbRunning: true,

      setFps: (v) => set({ fps: v }),
      setTaskbarStyle: async (style) => {
        const border = get().taskbarBorder
        set({ taskbarStyle: style })
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('set_taskbar_style', { style, showBorder: border })
          const res = await invoke('get_taskbar_style')
          if (res) {
            set({
              taskbarStyle: res.style || style,
              taskbarBorder: res.showBorder ?? border,
              translucentTbInstalled: res.translucentTbInstalled ?? true,
              translucentTbRunning: res.translucentTbRunning ?? true,
            })
          }
        } catch (e) {
          console.warn('[Store] set_taskbar_style error:', e)
        }
      },
      setTaskbarBorder: async (border) => {
        const style = get().taskbarStyle
        set({ taskbarBorder: border })
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('set_taskbar_style', { style, showBorder: border })
          const res = await invoke('get_taskbar_style')
          if (res) {
            set({
              taskbarStyle: res.style || style,
              taskbarBorder: res.showBorder ?? border,
              translucentTbInstalled: res.translucentTbInstalled ?? true,
              translucentTbRunning: res.translucentTbRunning ?? true,
            })
          }
        } catch (e) {
          console.warn('[Store] set_taskbar_border error:', e)
        }
      },
      syncTaskbarState: async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          const res = await invoke('get_taskbar_style')
          if (res) {
            set({
              taskbarStyle: res.style || 'default',
              taskbarBorder: res.showBorder ?? false,
              translucentTbInstalled: res.translucentTbInstalled ?? true,
              translucentTbRunning: res.translucentTbRunning ?? true,
            })
          }
        } catch {
          // ignore outside tauri
        }
      },
      restartTaskbar: async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('restart_taskbar_explorer')
          // Allow Explorer and TranslucentTB to initialize their windows
          await new Promise(r => setTimeout(r, 3500))
          const res = await invoke('get_taskbar_style')
          if (res) {
            set({
              taskbarStyle: res.style || 'default',
              taskbarBorder: res.showBorder ?? false,
              translucentTbInstalled: res.translucentTbInstalled ?? true,
              translucentTbRunning: res.translucentTbRunning ?? true,
            })
          }
        } catch (e) {
          console.warn('[Store] restartTaskbar error:', e)
        }
      },
      toggleAutoStart: () => set((s) => ({ autoStart: !s.autoStart })),
      toggleRunInTray: () => set((s) => ({ runInTray: !s.runInTray })),
      togglePauseOnBattery: () => set((s) => ({ pauseOnBattery: !s.pauseOnBattery })),
      togglePauseOnFullscreen: () => set((s) => ({ pauseOnFullscreen: !s.pauseOnFullscreen })),
      togglePauseOnMaximized: () => set((s) => ({ pauseOnMaximized: !s.pauseOnMaximized })),
      setMultiMonitorPauseMode: (v) => set({ multiMonitorPauseMode: v }),
      setAudioPlaybackRule: (v) => set({ audioPlaybackRule: v }),
      setPreferredAudioMonitor: (v) => set({ preferredAudioMonitor: v }),
      toggleAudioReactive: () => set((s) => ({ audioReactive: !s.audioReactive })),
      setAudioSource: (v) => set({ audioSource: v }),

      // ── UI State (non-persisted) ──────────────────────────────────────────
      currentPage: 'home',
      sidebarCollapsed: false,

      setCurrentPage: (page) => set({ currentPage: page }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // ── Auth State ──────────────────────────────────────────────────────────
      authUser: null,        // { id, email, user_metadata: { full_name, avatar_url, ... } }
      authSession: null,     // Supabase session with access_token
      isAuthenticated: false,
      showAuthModal: false,  // Whether the auth modal is visible

      setAuthUser: (user, session) => set({
        authUser: user ? {
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata || {},
        } : null,
        authSession: session || null,
        isAuthenticated: !!user,
      }),
      clearAuth: () => set({
        authUser: null,
        authSession: null,
        isAuthenticated: false,
      }),
      setShowAuthModal: (v) => set({ showAuthModal: v }),

      // ── Glassmorphism Controls ─────────────────────────────────────────────
      cardOpacity: 0.92,
      cardBlur: 12,
      sidebarOpacity: 0.88,

      setCardOpacity: (v) => set({ cardOpacity: v }),
      setCardBlur: (v) => set({ cardBlur: v }),
      setSidebarOpacity: (v) => set({ sidebarOpacity: v }),
    }),
    {
      name: 'aetherflow-state',
      version: 3,
      migrate: (persistedState, version) => {
        if (!version || version < 2) {
          if (persistedState) {
            persistedState.thumbnailMode = 'hover'
          }
        }
        if (!version || version < 3) {
          if (persistedState) {
            if (persistedState.pauseOnMaximized === undefined) {
              persistedState.pauseOnMaximized = true
            }
            if (!persistedState.multiMonitorPauseMode) {
              persistedState.multiMonitorPauseMode = 'per-display'
            }
            if (!persistedState.audioPlaybackRule) {
              persistedState.audioPlaybackRule = 'mute-covered'
            }
          }
        }
        return persistedState
      },
      // Only persist these keys (NEVER persist complex session objects)
      partialize: (s) => ({
        activeWallpaper: s.activeWallpaper,
        currentDesktopWallpaper: s.currentDesktopWallpaper,
        wallpaperOpacity: s.wallpaperOpacity,
        wallpaperBrightness: s.wallpaperBrightness,
        wallpaperSpeed: s.wallpaperSpeed,
        activeTheme: s.activeTheme,
        themes: s.themes,
        installed: s.installed,
        autoStart: s.autoStart,
        runInTray: s.runInTray,
        pauseOnBattery: s.pauseOnBattery,
        pauseOnFullscreen: s.pauseOnFullscreen,
        pauseOnMaximized: s.pauseOnMaximized,
        multiMonitorPauseMode: s.multiMonitorPauseMode,
        audioPlaybackRule: s.audioPlaybackRule,
        preferredAudioMonitor: s.preferredAudioMonitor,
        audioReactive: s.audioReactive,
        audioSource: s.audioSource,
        fps: s.fps,
        cardOpacity: s.cardOpacity,
        cardBlur: s.cardBlur,
        sidebarOpacity: s.sidebarOpacity,
        screenArrangement: s.screenArrangement,
        monitorWallpapers: s.monitorWallpapers,
        audioVolume: s.audioVolume,
        audioMuted: s.audioMuted,
        thumbnailMode: s.thumbnailMode,
        glowAmbience: s.glowAmbience,
        reducedMotion: s.reducedMotion,
        wallpaperAudioSettings: s.wallpaperAudioSettings,
        homeWallpaperIds: s.homeWallpaperIds,
        likedWallpaperIds: s.likedWallpaperIds,
        customNames: s.customNames,
        isWallpaperRunning: s.isWallpaperRunning,
        taskbarStyle: s.taskbarStyle,
        taskbarBorder: s.taskbarBorder,
        screensaverEnabled: s.screensaverEnabled,
        screensaverTimeoutMins: s.screensaverTimeoutMins,
        screensaverMode: s.screensaverMode,
        screensaverSpecificEngine: s.screensaverSpecificEngine,
        screensaverFadeInSecs: s.screensaverFadeInSecs,
        screensaverLockOnResume: s.screensaverLockOnResume,
        screensaverGracePeriodSecs: s.screensaverGracePeriodSecs,
        screensaverMuteAudio: s.screensaverMuteAudio,
        authUser: s.authUser ? {
          id: s.authUser.id,
          email: s.authUser.email,
          user_metadata: s.authUser.user_metadata || {},
        } : null,
        isAuthenticated: !!s.isAuthenticated,
      }),
    }
  )
)
