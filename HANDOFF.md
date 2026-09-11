# AetherFlow — Session Handoff File
> **Updated:** 2026-09-12 02:30 IST | **Current Version:** `1.0.7` | **Active Branch:** `ui/ux` | **Status:** 🟡 In Progress. Lively v2.1 features added: 16×8 Grid Diagnostic, Screensaver system, Visualizer Audio Source dropdown + VU meter, Picture 5-Fit selector + matte background, and Display 1/2 sorting. Screensaver multi-monitor white flash on Screen 2 and tray edge-to-edge coverage queued for next session. Standalone binary updated (`.\AetherFlow.exe`, 7.15 MB, PID 35144). Frontend builds cleanly in 675ms.

---

## 🧠 Context Snapshot (Read First)

We are building **AetherFlow** — a **high-performance, standalone Windows desktop application** similar to Wallpaper Engine + Lively. It runs animated live desktop wallpapers, manages multi-monitor setups, natively styles the Windows taskbar, provides an offline-safe community wallpaper marketplace, and offers full theme customization.

- **Project Location:** `C:\Users\Yashpreet_o7\Desktop\AetherFlow\`
- **Independent Project:** Completely separated from `C:\Users\Yashpreet_o7\Desktop\PERSONALAGENT\` (do NOT touch).
- **Current Version:** `1.0.7`
- **Active Git Branch:** `ui/ux` (synced with `origin/ui/ux`)
- **Release Page:** [github.com/yashpreeto7/aetherflow/releases/tag/v1.0.7](https://github.com/yashpreeto7/aetherflow/releases/tag/v1.0.7)
- **Older Releases:** All releases (v1.0.0 through v1.0.7) are preserved on GitHub.
- **Local Executable:** `C:\Users\Yashpreet_o7\Desktop\AetherFlow\AetherFlow.exe` (updated release binary, 7.09 MB)
- **Local Dev Server:** Active in background on port `1420` (`http://localhost:1420/`).
- **User Validation:** User tested the latest build and confirmed: *"i am very happy with the app"*.

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
3. **Advanced Win32 Occlusion & Power Management**:
   - **Pause on Fullscreen Windows**: Pauses rendering when applications enter fullscreen (covering the taskbar, F11, video games, borderless windows).
   - **Pause on Maximized Windows**: Suspends rendering when standard desktop applications (Brave, Chrome, VS Code) are maximized.
   - **Multi-Monitor Isolated (Per-Display) Pausing**: Fullscreen on Monitor 1 pauses Monitor 1, while Monitor 2 continues running smoothly without focus amnesia.
   - **Multi-Monitor Global (All Displays) Pausing**: Pauses all monitors whenever any single monitor is covered.
   - **Wallpaper Audio Playback Policies**:
     - `Mute When Covered` (Default): Automatically mutes wallpaper sound when active screens are covered by maximized or fullscreen windows.
     - `Mute When Focused`: Mutes wallpaper audio whenever any non-desktop application has focus.
     - `Always Active`: Keeps wallpaper audio playing continuously even when browsing or multitasking.
4. **Theme Studio & Import/Export System**:
   - 6 Sovereign built-in themes (Onyx, Slate, Studio, Obsidian, Manifesto, Light).
   - **Custom Theme Studio**: Non-intrusive Draft Mode with live preview, token tweaking (HEX/RGB), starter presets, and persistent saving.
   - **Theme Import & Export**: One-click JSON export to file or clipboard, plus validation and auto-activation on `.json` import.
5. **Dedicated Account & Cloud Sync**:
   - Account settings in Settings tab for both Authenticated and Guest users.
   - 100% offline-first functionality: fully functional with or without Supabase credentials.
   - OAuth login (Google & GitHub) with deep linking and custom token persistence.
6. **Native Translucent Taskbar**:
   - Live real-time styling (Clear, Acrylic, Blur, Default) with auto-persistence across Windows Explorer restarts.
7. **Performance & Memory Protection**:
   - Viewport lazy loading and automatic off-screen unloading via `IntersectionObserver`.
   - Bounded hardware video decoder usage preventing GPU/RAM exhaustion.
   - Top preview pause button for zero GPU/RAM consumption.
8. **In-App Auto-Updater**:
   - Integrates with GitHub Releases to check for updates and download latest installers.

---

## 🔍 Recent Major Achievements & Architectural Decisions

### 1. Win32 Occlusion & Multi-Monitor Pausing Engine Overhaul (v1.0.7+)
- **Problem**:
  - Fullscreen (e.g. Antigravity) and maximized (e.g. Brave) windows were not pausing wallpapers at all.
  - "Mute When Covered" was not muting when displays were covered; it was muting on focus instead, leaving music active unexpectedly.
- **Root Cause**:
  - `EnumWindows` stopped after 50 raw HWNDs, exhausting its count on invisible/cloaked background system windows before discovering visible windows on secondary monitors.
  - Fullscreen detection checked `!has_caption`, which rejected modern Electron/Chromium apps (VS Code, Antigravity, Chrome/Brave F11, borderless games) that retain `WS_CAPTION` style bits in `GWL_STYLE`.
  - Maximized windows were not taking into account Windows 10/11 invisible -8px drop-shadow margins.
  - `any_monitor_covered` in Rust was gated by `should_pause`, remaining false if `pause_on_maximized` was false, preventing "Mute When Covered" from detecting covered displays.
- **Architectural Solution**:
  - Rewrote `enum_occlusion_proc` to filter out hidden, minimized, cloaked, and tool windows, and filter out AetherFlow's own process PID (`GetWindowThreadProcessId`).
  - Allowed enumeration of up to 120 genuine visible candidate application windows across all connected displays.
  - Defined Fullscreen as covering physical monitor bounds (`rcMonitor` with 10px margin) without the obsolete `!has_caption` restriction.
  - Defined Maximized as `IsZoomed(hwnd)` or filling the monitor work area (`rcWork` with 15px margin).
  - Decoupled `any_monitor_covered` from animation pause state so "Mute When Covered" evaluates true screen occlusion.
  - Set default `pauseOnMaximized: true` across frontend and backend.
  - Added periodic diagnostic output (`[SYSTEM MONITOR DIAG]`) every 6 seconds in `desktop_debug.log`.

### 2. Multi-Monitor Isolated Pausing & Focus Amnesia Elimination
- **Problem**: When Antigravity was fullscreen on the right monitor and Brave was maximized on the left monitor, focusing on Brave caused the right monitor to unpause and start playing audio.
- **Solution**:
  - Implemented per-monitor Z-order occlusion tracking in `src-tauri/src/main.rs`.
  - In `Isolated (Per-Display)` mode, each display's occlusion status is evaluated independently.
  - If Monitor 1 is covered by Antigravity, it remains paused regardless of which window has keyboard/mouse focus.
  - If Monitor 2 is covered by Brave (with `pauseOnMaximized: true`), Monitor 2 also pauses and audio remains muted.

### 3. Custom Theme Studio & Import/Export System
- **Problem**: Opening the theme studio immediately overrode the active theme before the user customized anything, and there was no way to share or backup custom themes.
- **Solution**:
  - Studio initializes in **Draft Mode** with **Preview OFF**, leaving active app and desktop themes untouched.
  - Live Preview engages dynamically when the user adjusts a color picker or selects a starter preset.
  - Added manual **Preview ON/OFF** toggle and clean revert on "Cancel & Reset".
  - Built 1-click **Export Active**, **Export Custom**, and file-based `.json` **Import** with schema validation and hex/RGB normalization.

### 4. Dedicated Account Tab in Settings
- **Features**:
  - Clean view for authenticated users (avatar, name, email, copy User ID chip, provider badge, sign out).
  - Informational view for guest users highlighting offline capabilities and benefits of cloud sync.
  - Live Supabase cloud and local storage diagnostic indicators.

### 5. Viewport Lazy Loading & Off-Screen Unloading
- **Architecture**:
  - `IntersectionObserver` with `rootMargin: '140px 0px'` in `WallpaperThumbnail/index.jsx`.
  - Automatically unmounts off-screen video and high-res media elements, destroying hardware video decoders synchronously and eliminating GPU memory leaks.
  - Exactly 4 cards in viewport mount media at any time.

---

## 📁 Complete File Tree

```
C:\Users\Yashpreet_o7\Desktop\AetherFlow\
├── AetherFlow.exe                  ✅ Standalone native release executable (v1.0.7, 7.09 MB)
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
│       ├── main.rs                 ✅ Core Rust backend (window management, occlusion engine, tray, IPC commands)
│       ├── mpv.rs                  ✅ Native MPV video engine integration & process manager
│       └── taskbar.rs              ✅ Win32 taskbar composition & TranslucentTB integration
├── src/
│   ├── main.jsx                    ✅ React entrypoint, error boundary, theme hydration
│   ├── wallpaper.jsx               ✅ Wallpaper host entrypoint, canvas renderer, mute/pause listeners
│   ├── App.jsx                     ✅ Main control panel shell, layout, router, performance sync on boot
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
│   │   └── Settings.jsx            ✅ Performance controls, taskbar styling, theme studio, account, updates
│   ├── store/
│   │   └── useStore.js             ✅ Zustand persisted store with version 2 migration, pause/mute settings
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
# 1. Build frontend (Vite)
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
- **Process Status**: `AetherFlow.exe` running with version `1.0.7` (latest build).
- **Heartbeat**: Active (`[FRONTEND HEARTBEAT] page=/, visibility=visible, mounted=true`).
- **Dev Server**: Active in background at `http://localhost:1420/`.
- **Current Branch**: `ui/ux` (synced with `origin/ui/ux`).
- **Working Tree**: Clean, verified, and operational.
