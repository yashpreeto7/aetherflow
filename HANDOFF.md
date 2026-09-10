# AetherFlow — Session Handoff File
> **Updated:** 2026-09-10 23:35 IST | **Status:** ✅ COMPLETE — Resolved duplicate Apply to Desktop button, added dedicated Preview button & HomePreviewModal, enabled hardware-accelerated video poster frame thumbnails via VideoThumbnailCard & HTTP 206 range streaming in dev server. Built & deployed AetherFlow.exe.

---

## 🧠 Context Snapshot (Read First)

We are building **AetherFlow** (formerly AuraOS) — a **high-performance, standalone Windows desktop application** similar to Wallpaper Engine + Lively. It runs animated live desktop wallpapers, manages multi-monitor setups, natively styles the Windows taskbar, and provides an offline-safe community wallpaper marketplace.

- **Project Location:** `C:\Users\Yashpreet_o7\Desktop\AetherFlow\`
- **Independent Project:** Completely separated from `C:\Users\Yashpreet_o7\Desktop\PERSONALAGENT\` (do NOT touch).
- **Current Version:** `1.0.4`
- **Release Executable:** `C:\Users\Yashpreet_o7\Desktop\AetherFlow\AetherFlow.exe`

---

## 🚀 Key Features & Capabilities

1. **Live Animated Desktop Wallpapers**:
   - Pinned into the Windows desktop shell layer behind desktop icons (`Progman` / `WorkerW`).
   - Reasserts `MAIN_HWND` foreground priority so the main control panel is never obscured.
2. **Comprehensive Media Engine Support**:
   - **Local Video Engine**: Standalone high-performance MPV player (`AetherFlow-VideoEngine.exe`) supporting MP4, WebM, MKV with hardware decoding, per-monitor volume/mute, speed, brightness, and opacity controls.
   - **Procedural Canvas 2D Engines**: 7 ultra-lightweight built-in engines (`matrix-rain`, `cyber-particles`, `synthwave-grid`, `deep-space`, `aurora`, `tokyo-rain`, `audio-spectrum`).
   - **Image Engine**: Picture wallpaper player for PNG, JPG, WebP.
   - **Live Web & YouTube Streams**: Dual-player buffer with iframe UI cleaning and strict-origin embed policies.
3. **Native Translucent Taskbar**:
   - Live real-time styling (Clear, Acrylic, Blur, Default) with auto-persistence across Windows Explorer restarts.
4. **Theme System**:
   - 6 Sovereign themes (Onyx, Emerald, Velvet, Cyberpunk, Manifesto, Sakura) + CSS variable customization.
5. **In-App Auto-Updater**:
   - Integrates with GitHub Releases to check for updates and download latest installers.
6. **Community Marketplace & OAuth Authentication**:
   - Supabase-backed community wallpaper browsing, installation, and publication.
   - Dedicated clean OAuth popup window with Chrome 130 User-Agent avoiding Google disallowed user-agent blocks.
   - 1-click installation without mandatory login requirement.

---

## 🔍 Recent Bug Fixes & Architecture Notes

### 1. App "Pops Up and Closes but in System Tray" (Resolved 2026-09-10)
- **Root Cause**: Win32 `SetThreadDesktop` / `attach_thread_to_desktop()` calls were placed on the main GUI thread in `main()` and window pinning routines. In Windows, switching a thread's desktop changes its message queue and window station desktop association, corrupting Tao and Microsoft Edge WebView2 initialization. Additionally, `ensure_wallpaper_windows` was placed inside a background `std::thread::spawn`, where `win.hwnd()` returned `RawHandleError(Unavailable)`.
- **Solution**:
  - Removed all `SetThreadDesktop` and `attach_thread_to_desktop()` calls from `main()`, `pin_hwnd_as_wallpaper`, and `reconcile_wallpaper_windows`.
  - Restored synchronous execution of `ensure_wallpaper_windows(app.handle())` on the main UI thread inside `.setup(|app| { ... })`.
  - Registered `MAIN_HWND` directly on the main thread right after `build()`.
  - Verified `AetherFlow.exe` launches smoothly, stays focused and visible (`[MAIN WIN EVENT] Focused: true`), and sends continuous heartbeats (`page=/, visibility=visible, mounted=true`).

### 2. System Tray Retention & Single-Instance IPC (Resolved 2026-09-10)
- **Root Cause**: Local variable `let _tray = TrayIconBuilder::new()...build(app)?` inside `.setup` dropped when `setup` exited, sending `NIM_DELETE` and removing the icon from the Windows system tray.
- **Solution**: Stored the built tray into static memory `static TRAY_HOLDER: Mutex<Option<tauri::tray::TrayIcon>> = Mutex::new(None);`. Replaced custom mutex exit with `tauri-plugin-single-instance` IPC and tray menu restore hooks.

### 3. Sign-In & Authentication Flow (Resolved 2026-09-10)
- **Root Cause**: `onAuthStateChange` in `src/App.jsx` was previously clearing auth on initial undefined sessions on cold boot, wiping saved users. `AuthModal` was leaving `loading` active indefinitely if external browser logins occurred, intercepting all app clicks.
- **Solution**:
  - `onAuthStateChange` now only calls `clearAuth()` on an explicit `event === 'SIGNED_OUT'`.
  - `AuthModal` auto-closes on `isAuthenticated`, has a 2.5s timeout on `loading` state to prevent UI freeze, and supports click-outside dismissal.
  - Native `open_oauth_window` in `src-tauri/src/main.rs` intercepts `on_navigation` callbacks for `access_token` and emits `aura:oauth-callback` to the desktop app.
  - `Marketplace.jsx` falls back to fetching `access_token` directly from Supabase session if `authSession` was not in state.

### 4. React Error Boundary Crash: convertFileSrc is not defined (Resolved 2026-09-10)
- **Root Cause**: `src/components/WallpaperThumbnail/index.jsx` invoked bare `convertFileSrc(videoPath)` and `convertFileSrc(imgPath)` on lines 215 and 242 when hovering custom video or image cards without importing `convertFileSrc`. This triggered a runtime ReferenceError that crashed the React tree into `<ErrorBoundary>` ("Something went wrong: convertFileSrc is not defined").
- **Solution**:
  - Imported and hooked `safeConvertFileSrc` in `WallpaperThumbnail/index.jsx` wrapped inside a `try / catch` block with video `onError` fallback to the zero-RAM vector badge.
  - Exported `export const convertFileSrc = safeConvertFileSrc` in `src/lib/wallpaperActions.js`.
  - Added global bindings `window.convertFileSrc = safeConvertFileSrc` and `globalThis.convertFileSrc = safeConvertFileSrc` in `src/main.jsx`.
  - Rebuilt production frontend and release binary `AetherFlow.exe` (v1.0.4).

### 5. Community Marketplace Backend & Live Supabase Migration (Completed 2026-09-10)
- **Supabase Direct Integration**: Replaced Cloudflare Worker dependency with direct Supabase calls and RPC functions. Created `supabase/migration.sql` with tables (`user_profiles`, `submissions`, `installs`, `likes`), RLS security policies, and 4 RPC functions (`track_install`, `toggle_like`, `get_user_likes`, `marketplace_stats`). Executed migration in Supabase SQL editor successfully.
- **Community Catalog & Curation**: Expanded community catalog (`yashpreeto7/aetherflow-community`) to 20 curated wallpapers (11 YouTube + 9 Image). Swapped catalog CDN URLs in `src/lib/marketplace.js` so `raw.githubusercontent.com` is primary (bypassing 24h jsDelivr caching). Reset mock seed numbers to 0 for authentic organic stats, and added `featured: true` flags with a golden "★ STAFF PICK" badge overlay (`Award` icon) in `Marketplace.jsx`.
- **Like Counter & Sync Fix**: Added optimistic and server-synchronized like tracking (`likeCounts` state map + `toggleLike` RPC). Resolved issue where heart toggled pink but the count did not increment (+1) by syncing real-time totals from the Supabase RPC response.
- **Submissions & Download Tracking**: Added "My Submissions" tab with pending/approved/rejected review status tracking, and wired `trackInstall` into the 1-click "Install & Apply" flow.

### 6. Orphaned MPV Process on Taskbar / Task Manager "End Task" (Resolved 2026-09-10)
- **Root Cause**: When the user right-clicked AetherFlow on the taskbar and chose "End task" (or killed AetherFlow via Task Manager), Windows executed `TerminateProcess(hProcess, 1)`. User-mode termination handlers (`Drop`, `atexit`, tray shutdown hooks) never run during an abrupt termination. Furthermore, AetherFlow's main job object had `JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK`, which explicitly caused child processes spawned by `Command::spawn()` to break out of the parent job. Consequently, `AetherFlow-VideoEngine.exe` / `mpv.exe` processes were orphaned, remained pinned to the desktop layer, and continued rendering video indefinitely.
- **Solution**:
  - Implemented a dedicated Windows Job Object (`MPV_JOB_HANDLE`) in `src-tauri/src/mpv.rs` configured strictly with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` without breakaway flags.
  - Bound every spawned child process directly to `MPV_JOB` using `assign_child_to_mpv_job(&child)`.
  - Added cold-boot stale process purge (`mpv::kill_all_mpv_processes()`) and job pre-initialization at the start of `.setup`.
  - Tested and verified: When AetherFlow is forcefully terminated via `TerminateProcess`, the Windows NT kernel immediately closes the job object handle and forcibly terminates all associated MPV video engines with zero lag.
  - Recompiled and deployed release binary `AetherFlow.exe` (v1.0.4, 7.41MB).

### 7. Marketplace "Add to Library", Zero-Memory-Leak Live Preview, & Download Count Sync (Resolved 2026-09-10)
- **Add to Library & Card Button Layout**:
  - Implemented `handleAddToLibrary(wallpaper)` in `src/pages/Marketplace.jsx`. Allows users to download and add community wallpapers directly to their Library without forcing immediate desktop wallpaper application.
  - Card UI footer now displays an unmistakable action button bar on every card:
    - **`[👁 Preview]`**: Dedicated preview button right in the card footer next to action buttons, in addition to the thumbnail click.
    - **`[+ Library]`**: Added for uninstalled wallpapers; transitions to a green **`[✓ In Library]`** badge once added.
    - **`[▷ Apply]`**: Installs and applies directly to the Windows desktop.
- **De-cluttering Home Screen**:
  - **Root Cause**: `Home.jsx` previously had `if (w.isCustom) return true`, which forced ALL custom and marketplace wallpapers onto Home regardless of `homeWallpaperIds`. Furthermore, `useStore.js` `syncCustomWallpapersFromDisk()` was forcibly adding all disk items to `homeWallpaperIds`.
  - **Solution**: Removed the forced custom inclusion in `Home.jsx`, filtered community wallpapers out of `homeWallpaperIds` in `useStore.js`, and removed `pinToHome` calls from marketplace install/add routines. Marketplace wallpapers now stay cleanly inside the **Library** unless the user explicitly pins them.
- **Zero-Memory-Leak Live Preview Modal**:
  - Implemented `MarketplacePreviewModal` rendered via `createPortal(..., document.body)` to escape parent CSS transforms and guarantee perfect viewport centering and isolation.
  - Added `CleanYouTubePreview`: Dynamically mounts iframe with full autoplay/mute/loop parameters, and upon modal close / unmount, immediately sets `iframe.src = 'about:blank'` and removes the element. This forces Chromium/WebView2 to instantly terminate audio/video decoding pipelines and discard GPU buffers.
  - Added `CleanVideoPreview`: Explicitly executes `video.pause()`, `video.removeAttribute('src')`, and `video.load()` on unmount.
  - Added `CleanImagePreview`: Renders image cleanly with proper unmount cleanup.
  - Verified in DevTools: Closing the modal yields `iframeCount: 0`, `modalCount: 0`, and halts media streams. Supports Escape key, backdrop click, and X button.
- **Download Count Real-Time Sync**:
  - Root cause: `Marketplace.jsx` previously hardcoded `{(item.downloads || 0).toLocaleString()}` from GitHub's static `index.json`. It never queried Supabase's `installs` table and never stored or rendered an in-memory `downloadCounts` state.
  - Solution: Added `fetchMarketplaceCounts()` to `src/lib/marketplace.js`, populated `downloadCounts` on mount in `Marketplace.jsx`, updated cards and modal to render `Math.max(item.downloads || 0, downloadCounts[item.id] ?? 0)`, and optimistically incremented count on "+ Library" and "Apply" with server total sync. All 20 wallpapers now reflect their real install counts.

---

## 📁 Complete File Tree

```
C:\Users\Yashpreet_o7\Desktop\AetherFlow\
├── AetherFlow.exe                  ✅ Standalone native executable (v1.0.4)
├── package.json                    ✅ npm scripts and dependencies
├── vite.config.js                  ✅ Vite 8 build config (oxc minifier, rolldown manualChunks)
├── supabase/
│   └── migration.sql               ✅ Supabase SQL migration (tables, RLS policies, RPC functions)
├── index.html                      ✅ Control panel HTML entrypoint
├── wallpaper.html                  ✅ Dedicated wallpaper host HTML entrypoint
├── src-tauri/
│   ├── Cargo.toml                  ✅ Tauri 2 + windows-sys + release optimization profile
│   ├── tauri.conf.json             ✅ App identity (com.aetherflow.app), window configs, bundle
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
│   │   ├── WallpaperPlayer/        ✅ Interactive wallpaper preview player
│   │   ├── WallpaperThumbnail/     ✅ Hover preview thumbnail card component
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
│   │   ├── image-player.js         ✅ Picture wallpaper engine (PNG/JPG/WebP)
│   │   ├── video-player.js         ✅ MPV bridge engine
│   │   └── web-stream.js           ✅ YouTube & live web stream engine
│   ├── lib/
│   │   ├── supabase.js             ✅ Offline-safe Supabase client & OAuth handlers
│   │   ├── marketplace.js          ✅ Supabase direct RPC backend (likes, installs, submissions, stats)
│   │   ├── updater.js              ✅ GitHub Releases auto-updater module
│   │   └── wallpaperActions.js     ✅ Desktop wallpaper apply, pause, and IPC bridge
│   ├── pages/
│   │   ├── Home.jsx                ✅ Active wallpaper preview, hero card, controls, theme switcher
│   │   ├── Marketplace.jsx         ✅ Browse, search, tag filter, direct 1-click apply, submit
│   │   ├── Library.jsx             ✅ Installed wallpapers, custom media add, activate/uninstall
│   │   └── Settings.jsx            ✅ Taskbar styling, power management, autostart, updates
│   ├── store/
│   │   └── useStore.js             ✅ Zustand persisted store with custom wallpaper disk sync
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
- **Process Status**: `AetherFlow.exe` running with parent `0x0`, top-level foreground access.
- **Heartbeat**: Active (`[FRONTEND HEARTBEAT] page=/, visibility=visible, mounted=true`).
- **Video Engine**: `AetherFlow-VideoEngine.exe` instances running on all active displays with proper Z-ordering behind desktop icons.
- **Tray**: `TRAY_HOLDER` holds system tray icon persistently with working click/double-click restore actions.
