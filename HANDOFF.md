# AetherFlow — Session Handoff File
> **Updated:** 2026-09-11 17:06 IST | **Current Version:** `1.0.7` | **Active Branch:** `ui/ux` | **Status:** ✅ Release v1.0.7 Published. Branch `ui/ux` active for UI/UX overhaul.

---

## 🧠 Context Snapshot (Read First)

We are building **AetherFlow** — a **high-performance, standalone Windows desktop application** similar to Wallpaper Engine + Lively. It runs animated live desktop wallpapers, manages multi-monitor setups, natively styles the Windows taskbar, and provides an offline-safe community wallpaper marketplace.

- **Project Location:** `C:\Users\Yashpreet_o7\Desktop\AetherFlow\`
- **Independent Project:** Completely separated from `C:\Users\Yashpreet_o7\Desktop\PERSONALAGENT\` (do NOT touch).
- **Current Version:** `1.0.7`
- **Active Git Branch:** `ui/ux` (synced with `origin/ui/ux`)
- **Release Page:** [github.com/yashpreeto7/aetherflow/releases/tag/v1.0.7](https://github.com/yashpreeto7/aetherflow/releases/tag/v1.0.7)
- **Older Releases:** All releases (v1.0.0 through v1.0.7) are preserved on GitHub.
- **Local Executable:** `C:\Users\Yashpreet_o7\Desktop\AetherFlow\AetherFlow.exe` (updated with v1.0.7 binary)
- **Local Dev Server:** Running in background on port `1420` (`http://localhost:1420/`).
- **Upcoming Work:** UI/UX redesign on the `ui/ux` branch using the assets in `ui improvement ideas/`.

---

## 🚀 Key Features & Capabilities

1. **Live Animated Desktop Wallpapers**:
   - Pinned into the Windows desktop shell layer behind desktop icons (`Progman` / `WorkerW`).
   - Reasserts `MAIN_HWND` foreground priority so the main control panel is never obscured.
2. **Comprehensive Media Engine Support**:
   - **Local Video Engine**: Standalone high-performance MPV player (`AetherFlow-VideoEngine.exe`) supporting MP4, WebM, MKV with hardware decoding, per-monitor volume/mute, speed, brightness, and opacity controls.
   - **Procedural Canvas 2D Engines**: 7 ultra-lightweight built-in engines (`matrix-rain`, `cyber-particles`, `synthwave-grid`, `deep-space`, `aurora`, `tokyo-rain`, `audio-spectrum`).
   - **Image Engine**: Picture wallpaper player for PNG, JPG, WebP with `cover`, `contain`, `stretch` scaling.
   - **Live Web & YouTube Streams**: Dual-slot ping-pong buffer with iframe UI cleaning and strict-origin embed policies.
3. **Native Translucent Taskbar**:
   - Live real-time styling (Clear, Acrylic, Blur, Default) with auto-persistence across Windows Explorer restarts.
4. **Theme System**:
   - 6 Sovereign themes (Onyx, Slate, Studio, Obsidian, Manifesto, Light) + CSS variable customization.
5. **In-App Auto-Updater**:
   - Integrates with GitHub Releases to check for updates and download latest installers.
6. **Community Marketplace & OAuth Authentication**:
   - Supabase-backed community wallpaper browsing, installation, and publication.
   - 1-click installation without mandatory login requirement.
7. **Performance & Memory Protection**:
   - Viewport lazy loading and automatic off-screen unloading via `IntersectionObserver`.
   - Bounded hardware video decoder usage preventing GPU/RAM exhaustion.
   - Top preview pause button for zero GPU/RAM consumption.

---

## 🔍 Recent Major Achievements & Architectural Decisions

### 1. Default Thumbnail Mode to Hover & State Migration (v1.0.7)
- **Problem**: Earlier builds initialized thumbnail mode to `'always'` (On), mounting media across all cards on startup.
- **Solution**:
  - Set default `thumbnailMode: 'hover'` in `useStore.js`.
  - Added Zustand persistence migration (`version: 2`) so existing clients automatically migrate stored state from `'always'` to `'hover'` without wiping user libraries or custom wallpapers.
  - Verified toggle buttons on Home, Library, and Settings default to `[ Hover ]`.

### 2. Viewport Lazy Loading & Off-Screen Unloading (v1.0.7)
- **Problem**: When thumbnail mode was set to `'always'`, all 38+ cards mounted `<video>` or high-res `<img>` elements simultaneously, exhausting Direct3D hardware video decoders and causing heavy RAM/GPU memory usage.
- **Architecture Decision (Unload Off-Screen Cards)**:
  - Added an `IntersectionObserver` with `rootMargin: '140px 0px'` in `WallpaperThumbnail/index.jsx`.
  - When in viewport: Mounts the active `<video>` or high-res `<img>`.
  - When scrolled out of view: Unmounts the media element immediately. For `<video>` elements, `cleanupVideo()` runs synchronously, pausing the video, clearing its `src`, calling `load()`, and destroying the hardware video decoder pipeline.
  - While off-screen, cards preserve their dimensions and vector gradient badges, ensuring **zero layout shift**.
  - **Empirical Verification**: Exactly 4 cards in the viewport mount media. When scrolled to the bottom, the count remains at 4 cards (top cards unload cleanly).

### 3. Home Top Preview (Hero Banner) Sync & Remounting (v1.0.7)
- **Problem**: Applying a wallpaper from Library or Marketplace left the Home top preview stuck on the old wallpaper or broken.
- **Root Causes & Solutions**:
  - `applyWallpaperToDesktop` and `Library.jsx`'s `handleApply` now call `state.setActiveWallpaper(wallpaper)`.
  - `Home.jsx` auto-syncs `activeWallpaper` with `currentDesktopWallpaper` when returning to Home.
  - Added `key={activeWallpaper.id || activeWallpaper.name}` to `<WallpaperPlayer>` on the Home page, guaranteeing that switching between wallpapers of the same engine (e.g. video to video) completely tears down the old engine and renders the new wallpaper preview immediately.
  - Removed `crossOrigin = 'anonymous'` in `web-stream.js`, resolving browser CORS blocks when loading YouTube thumbnails (`img.youtube.com`) onto the canvas preview.
  - `Marketplace.jsx` dynamically detects videos, streams, and pictures, unmutes streams by default, and pins applied items to Home favorites.

### 4. Audio Control Polish & Multi-Monitor Sync (v1.0.6)
- **Problem**: Duplicate volume sliders, wallpaper starting at 100% volume despite lower setting, cursor blocking when dragging slider, and audio echo across multiple screens for YouTube wallpapers.
- **Solutions**:
  - Removed redundant top volume slider; kept single bottom slider with per-wallpaper adhered audio settings.
  - Added `--no-config` to MPV and prioritized `adheredAudio` on playback start.
  - Added `user-select: none`, `touch-action: none`, and 35ms IPC debouncing to volume slider dragging.
  - Locked secondary displays to `muted: true` in duplicate mode so audio plays only from the primary monitor, eliminating echo.
  - Fixed YouTube stream audio muting by identifying primary monitor label via `get_primary_monitor_label` in Rust and passing explicit `isPrimary`/`isSecondary` flags to webview instances.

### 5. Dedicated `ui/ux` Branch & UI Improvement Asset Intake
- **Branch**: Created `ui/ux` branch branched off `main`, pushed upstream to `origin/ui/ux`.
- **Assets**: User provided 9 UI reference images in `ui improvement ideas/`.
- **Guidance**: Use `ui-ux-pro-max` and `impeccable` design skills for tokens, layout, and component craft.

---

## 📁 Complete File Tree

```
C:\Users\Yashpreet_o7\Desktop\AetherFlow\
├── AetherFlow.exe                  ✅ Standalone native executable (v1.0.7)
├── package.json                    ✅ npm scripts and dependencies (v1.0.7)
├── vite.config.js                  ✅ Vite 8 build config (oxc minifier, rolldown manualChunks)
├── supabase/
│   └── migration.sql               ✅ Supabase SQL migration (tables, RLS policies, RPC functions)
├── ui improvement ideas/           📁 User-provided UI design reference images (9 files)
├── index.html                      ✅ Control panel HTML entrypoint
├── wallpaper.html                  ✅ Dedicated wallpaper host HTML entrypoint
├── src-tauri/
│   ├── Cargo.toml                  ✅ Tauri 2 + windows-sys + release optimization profile (v1.0.7)
│   ├── tauri.conf.json             ✅ App identity (com.aetherflow.app), window configs, bundle (v1.0.7)
│   └── src/
│       ├── main.rs                 ✅ Core Rust backend (window management, tray, IPC commands)
│       ├── mpv.rs                  ✅ Native MPV video engine integration & process manager
│       └── taskbar.rs              ✅ Win32 taskbar composition & TranslucentTB integration
├── src/
│   ├── main.jsx                    ✅ React entrypoint, error boundary, theme hydration
│   ├── wallpaper.jsx               ✅ Wallpaper host entrypoint & canvas renderer
│   ├── App.jsx                     ✅ Main control panel shell, layout, router, update toasts
│   ├── components/
│   │   ├── AuthModal/              ✅ Clean OAuth modal with auto-close & reset timeout
│   │   ├── ErrorBoundary/          ✅ React error catcher with reload/cache reset buttons
│   │   ├── UserAvatar/             ✅ Cross-origin safe user avatar with gradient fallback
│   │   ├── StatusBar/              ✅ Waybar-style status bar with live FPS & metrics
│   │   ├── WallpaperPlayer/        ✅ Interactive wallpaper preview player with key-based remounting
│   │   ├── WallpaperThumbnail/     ✅ Viewport lazy-loading thumbnail card with off-screen unloading
│   │   └── Modals/                 ✅ AddWallpaperModal, AddWebStreamModal, RenameWallpaperModal
│   ├── engines/
│   │   ├── index.js                ✅ Lazy-loaded engine registry & builtin themes list
│   │   ├── matrix-rain.js          ✅ Procedural Canvas 2D Katakana rain
│   │   ├── cyber-particles.js      ✅ Interactive particle network
│   │   ├── synthwave-grid.js       ✅ Retro 80s perspective grid
│   │   ├── deep-space.js           ✅ Parallax starfield & nebula
│   │   ├── aurora.js               ✅ Northern lights simulation
│   │   ├── tokyo-rain.js           ✅ Procedural neon cyberpunk rain
│   │   ├── audio-spectrum.js       ✅ Microphone-reactive CAVA-style visualizer
│   │   ├── fps-meter.js            ✅ Telemetry HUD with rolling FPS graph
│   │   ├── image-player.js         ✅ Picture wallpaper engine (PNG/JPG/WebP) with url fallback
│   │   ├── video-player.js         ✅ MPV bridge engine
│   │   └── web-stream.js           ✅ YouTube & live web stream engine with CORS fix
│   ├── lib/
│   │   ├── supabase.js             ✅ Offline-safe Supabase client & OAuth handlers
│   │   ├── marketplace.js          ✅ Supabase direct RPC backend (likes, installs, submissions, stats)
│   │   ├── updater.js              ✅ GitHub Releases auto-updater module (v1.0.7)
│   │   └── wallpaperActions.js     ✅ Desktop wallpaper apply, pause, and IPC bridge
│   ├── pages/
│   │   ├── Home.jsx                ✅ Active wallpaper preview, hero card, controls, theme switcher
│   │   ├── Marketplace.jsx         ✅ Browse, search, tag filter, direct 1-click apply, submit
│   │   ├── Library.jsx             ✅ Installed wallpapers, custom media add, activate/uninstall
│   │   └── Settings.jsx            ✅ Taskbar styling, power management, autostart, updates
│   ├── store/
│   │   └── useStore.js             ✅ Zustand persisted store with version 2 migration for hover default
│   └── styles/
│       ├── index.css               ✅ Design tokens, utility classes, buttons, toggles
│       └── themes.css              ✅ 6 Sovereign CSS custom property theme sets
├── CONTEXT.md                      ✅ Living project context & status
├── HANDOFF.md                      ✅ This file
├── REMAINING_TASKS.md              ✅ Task guide & optional feature list
└── SESSION_LOG.md                  ✅ Detailed chronologically maintained session logs
```

---

## 🛠️ Verification & Build Commands

```powershell
# 1. Build frontend
npm run build

# 2. Check Rust backend
cargo check --manifest-path src-tauri/Cargo.toml

# 3. Build optimized release executable
cargo build --release --manifest-path src-tauri/Cargo.toml

# 4. Copy binary to workspace root (for direct launching)
Copy-Item src-tauri\target\release\aetherflow.exe .\AetherFlow.exe -Force

# 5. Launch & verify
Start-Process .\AetherFlow.exe
```

---

## 📌 Active Runtime State
- **Process Status**: `AetherFlow.exe` running with version `1.0.7`.
- **Heartbeat**: Active (`[FRONTEND HEARTBEAT] page=/, visibility=visible, mounted=true`).
- **Dev Server**: Active at `http://localhost:1420/`.
- **Current Branch**: `ui/ux` (synced with `origin/ui/ux`).
- **Working Tree**: Clean, ready for UI/UX enhancements.
