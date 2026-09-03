import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * AuraOS Global State (Zustand)
 * Persisted to localStorage so settings survive restarts.
 */
export const useStore = create(
  persist(
    (set, get) => ({
      // ── Active Wallpaper ─────────────────────────────────────────────────
      activeWallpaper: null,          // { id, name, engine, config }
      wallpaperOpacity: 1,
      wallpaperBrightness: 0.85,
      wallpaperSpeed: 1,              // Global speed multiplier

      // Multi-Monitor & Audio
      screenArrangement: 'duplicate', // 'duplicate' | 'per-screen'
      monitorWallpapers: {},          // { [monitorLabel]: activeWallpaperObject }
      audioVolume: 50,                // 0 to 100
      audioMuted: false,

      setScreenArrangement: (v) => set({ screenArrangement: v }),
      setMonitorWallpaper: (label, wp) => set((s) => ({
        monitorWallpapers: { ...s.monitorWallpapers, [label]: wp }
      })),
      setAudioVolume: (v) => set({ audioVolume: v }),
      toggleAudioMuted: () => set((s) => ({ audioMuted: !s.audioMuted })),

      // isWallpaperRunning = true when the canvas is LIVE on the Windows desktop
      // (pinned into WorkerW via PROGMAN trick). Not the same as just being selected.
      // NOT persisted — resets to false on every app restart.
      isWallpaperRunning: false,

      setActiveWallpaper: (wallpaper) => set({ activeWallpaper: wallpaper }),
      setWallpaperRunning: (v) => set({ isWallpaperRunning: v }),
      setWallpaperOpacity: (v) => set({ wallpaperOpacity: v }),
      setWallpaperBrightness: (v) => set({ wallpaperBrightness: v }),
      setWallpaperSpeed: (v) => set({ wallpaperSpeed: v }),
      updateWallpaperConfig: (updates) => set((s) => ({
        activeWallpaper: s.activeWallpaper 
          ? { ...s.activeWallpaper, config: { ...s.activeWallpaper.config, ...updates } }
          : null
      })),

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
            document.documentElement.style.setProperty(key, value);
          });
        } else {
          // Clear any custom inline styles if switching to a built-in theme
          document.documentElement.removeAttribute('style');
        }
      },
      saveCustomTheme: (id, tokens) =>
        set((s) => ({ themes: { ...s.themes, [id]: tokens } })),

      // ── Library (installed wallpapers & themes) ──────────────────────────
      installed: [],                   // [{ id, type, name, engine, config, installedAt }]
      homeWallpaperIds: [              // IDs of wallpapers curated for Home screen
        'matrix-rain', 'cyber-particles', 'synthwave-grid',
        'deep-space', 'tokyo-rain', 'aurora', 'audio-spectrum'
      ],
      customNames: {},                 // { [id]: string } user-edited wallpaper names

      installItem: (item) =>
        set((s) => ({ installed: [...s.installed.filter(i => i.id !== item.id), item] })),
      uninstallItem: (id) =>
        set((s) => ({
          installed: s.installed.filter(i => i.id !== id),
          homeWallpaperIds: (s.homeWallpaperIds || []).filter(x => x !== id),
        })),

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

      // ── Renaming ──────────────────────────────────────────────────────────
      setWallpaperName: (id, newName) => set((s) => {
        const customNames = { ...(s.customNames || {}), [id]: newName }
        const installed = (s.installed || []).map(item =>
          item.id === id ? { ...item, name: newName } : item
        )
        const activeWallpaper = s.activeWallpaper?.id === id
          ? { ...s.activeWallpaper, name: newName }
          : s.activeWallpaper
        return { customNames, installed, activeWallpaper }
      }),

      // ── Settings ──────────────────────────────────────────────────────────
      autoStart: false,
      runInTray: true,
      pauseOnBattery: true,
      pauseOnFullscreen: true,
      audioReactive: false,
      audioSource: 'mic',             // 'mic' | 'system'
      fps: 60,                        // Target FPS cap

      setFps: (v) => set({ fps: v }),
      toggleAutoStart: () => set((s) => ({ autoStart: !s.autoStart })),
      toggleRunInTray: () => set((s) => ({ runInTray: !s.runInTray })),
      togglePauseOnBattery: () => set((s) => ({ pauseOnBattery: !s.pauseOnBattery })),
      togglePauseOnFullscreen: () => set((s) => ({ pauseOnFullscreen: !s.pauseOnFullscreen })),
      toggleAudioReactive: () => set((s) => ({ audioReactive: !s.audioReactive })),
      setAudioSource: (v) => set({ audioSource: v }),

      // ── UI State (non-persisted) ──────────────────────────────────────────
      currentPage: 'home',
      sidebarCollapsed: false,

      setCurrentPage: (page) => set({ currentPage: page }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // ── Glassmorphism Controls ─────────────────────────────────────────────
      cardOpacity: 0.92,
      cardBlur: 12,
      sidebarOpacity: 0.88,

      setCardOpacity: (v) => set({ cardOpacity: v }),
      setCardBlur: (v) => set({ cardBlur: v }),
      setSidebarOpacity: (v) => set({ sidebarOpacity: v }),
    }),
    {
      name: 'auraos-state',
      // Only persist these keys
      partialize: (s) => ({
        activeWallpaper: s.activeWallpaper,
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
        homeWallpaperIds: s.homeWallpaperIds,
        customNames: s.customNames,
      }),
    }
  )
)
