# AuraOS — Living Context File
<!-- AUTO-UPDATED: This file is rewritten at the end of every session. -->
<!-- If you are an AI agent, read this file FIRST before doing anything. -->

## Last Updated
2026-09-09 23:55 IST — Release v1.0.3: Bumped version across all packages, eliminated TranslucentTB restart conflicts via live folderwatcher reload, disabled Windows accent tint override, added Taskbar Top Border toggle, and triggered GitHub Release pipeline.

---

## What AuraOS Is

A **standalone Windows desktop application** that:
- Shows **live animated wallpapers** behind the Windows desktop (like Wallpaper Engine)
- Supports **local videos (MP4/WebM/MKV), picture wallpapers, canvas engines, and live YouTube/web streams**
- Lets users switch **themes** (6 Sovereign themes built-in) and style the **Windows Taskbar** natively
- Has an **in-app auto-updater** checking GitHub Releases with one-click download
- Is **ultra-lightweight**: ~8MB install, ~30MB RAM (uses WebView2, not Chromium)

**Location:** `C:\Users\Yashpreet_o7\Desktop\AetherFlow\`
**NOT related to:** `C:\Users\Yashpreet_o7\Desktop\PERSONALAGENT\` (different project, don't touch)

---

## Build Status

| Check | Result |
|-------|--------|
| `npm run build` | ✅ Passes in ~580ms |
| `npm run dev` | ✅ Runs at http://localhost:1420/ |
| `npm run tauri:dev` | ✅ Passes (Rust installed & verified) |
| Windows .exe / standalone | ✅ Built: `AetherFlow.exe`, `run.bat`, and `AetherFlow_1.0.1_x64-setup.exe` |

---

## Architecture Decisions (PERMANENT — Do Not Change)

| Decision | Choice | Reason |
|----------|--------|--------|
| Desktop framework | **Tauri 2** (NOT Electron) | 8MB vs 150MB, 30MB RAM vs 300MB |
| Frontend | **React 19 + Vite 8** | Fast HMR, tree-shaking |
| State | **Zustand** with persist | Simple, localStorage-backed |
| Wallpaper rendering | **Canvas 2D + MPV + WebStream** | Lightweight, no GPU dep, 60fps |
| Marketplace backend | **Supabase** (free tier) | Auth + DB + Storage |
| Minifier | **oxc** | Vite 8 dropped esbuild |
| manualChunks | **Function form** | rolldown requirement |
| Wallpaper pinning | **Frameless Tauri window** | WorkerW desktop layer |

---

## File Completion Status

### ✅ Complete
```
src/engines/matrix-rain.js          Canvas 2D katakana rain
src/engines/cyber-particles.js      Connected particle network, mouse repulsion
src/engines/synthwave-grid.js       Retro 80s grid with scrolling horizon
src/engines/deep-space.js           Parallax stars, nebula, shooting stars
src/engines/aurora.js               Borealis curtains over starfield
src/engines/tokyo-rain.js           Procedural neon city + rain
src/engines/audio-spectrum.js       Mic-reactive CAVA-style bars
src/engines/fps-meter.js            Canvas 2D telemetry HUD with live rolling FPS counter & graph
src/engines/image-player.js         Canvas 2D picture wallpaper engine (PNG/JPG/WebP)
src/engines/web-stream.js           YouTube & Live Web Stream engine (iframes & thumbnails)
src/engines/index.js                Lazy-loaded engine registry + theme list
src/store/useStore.js               Zustand persisted global state (with taskbarStyle)
src/styles/themes.css               6 Sovereign theme CSS token sets
src/styles/index.css                Global CSS utilities
src/components/WallpaperPlayer/     Engine lifecycle manager (canvas)
src/components/StatusBar/           Waybar-style FPS + status bar
src/components/Modals/              AddWallpaperModal, RenameWallpaperModal, AddWebStreamModal
src/lib/supabase.js                 Offline-safe Supabase marketplace API
src/lib/updater.js                  GitHub Releases Auto-Updater module
src/lib/wallpaperActions.js         Desktop wallpaper applicator & stream handlers
src/pages/Home.jsx                  Wallpaper grid, controls, stream modal, theme switcher
src/pages/Marketplace.jsx           Search, tags, publish form
src/pages/Library.jsx               Installed items, add stream, activate/uninstall
src/pages/Settings.jsx              Taskbar styling, software updates, FPS, audio, system
src/App.jsx                         Router, sidebar, layout, startup update toast
src/main.jsx                        Entry point, theme hydration, taskbar restoration
src-tauri/src/main.rs               Rust backend: window mgmt, tray, commands
src-tauri/src/taskbar.rs            Win32 SetWindowCompositionAttribute taskbar module
src-tauri/src/mpv.rs                Native MPV video playback integration
src-tauri/Cargo.toml                Release: lto + strip + opt-level=s
src-tauri/tauri.conf.json           System tray, NSIS installer config
vite.config.js                      Tauri-optimized, oxc minifier
package.json                        Scripts: dev, build, tauri:dev, tauri:build
AGENTS.md                           Full agent instructions
GEMINI.md                           Gemini-specific session start rules
REMAINING_TASKS.md                  Step-by-step remaining task guide
HANDOFF.md                          Session handoff with full status
```

### ❌ Not Done
```
Supabase DB tables                   marketplace SQL (optional)
```

### 🚀 Direct Launchers Available
```
AetherFlow.exe                       Direct standalone desktop app (root)
run.bat                              One-click batch launcher (root)
AetherFlow.bat                       Alternative batch launcher (root)
src-tauri/target/release/bundle/nsis/AetherFlow_1.0.0_x64-setup.exe  NSIS Windows Installer
```

---

## Key Rules (All agents must follow)

1. **Canvas 2D only** — never `getContext('webgl')`
2. **`isOnline()` check** — before every Supabase call
3. **`npm run build`** — after every significant change
4. **No hardcoded colors** — use `var(--color-brand)` etc.
5. **`minify: 'oxc'`** — not `'esbuild'`
6. **`manualChunks` as function** — not object literal
7. **Engine interface**: must export `{ start, stop, updateOptions }` factory
8. **Zustand partialize** — add any new persisted field to the `partialize` array

---

## Next Immediate Action

```powershell
# 1. Check if Rust installed
rustup --version

# 2. If not, install it
winget install Rustlang.Rustup
# (restart terminal after)
rustup default stable
rustup target add x86_64-pc-windows-msvc

# 3. Launch native Windows app
cd C:\Users\Yashpreet_o7\Desktop\AURAOS
npm run tauri:dev
# First run: 5-10 min compile. Subsequent: 10-30 sec.
```

---

## Session Log

| Date | Agent | What Was Done |
|------|-------|--------------|
| 2026-09-02 | Antigravity (Claude Sonnet 4.6) | Initial build: full frontend (all engines, themes, pages, components, Tauri config) |
| 2026-09-02 | Antigravity (Claude Sonnet 4.6) | Added .agents/ skills, AGENTS.md, GEMINI.md, REMAINING_TASKS.md, CONTEXT.md, hooks |
| 2026-09-02 | Antigravity (Gemini 3.1 Pro) | Rust configured, previews generated, Theme Editor implemented, Video Wallpaper Engine implemented, backend command added |
| 2026-09-02 | Antigravity (Gemini 3.8 Flash) | Multi-monitor geometry, frame offsets, Windows 11 desktop icon Z-order behind SHELLDLL_DefView resolved |
| 2026-09-03 | Antigravity (Gemini 3.8 Flash) | Wallpaper Engine UI/UX overhaul: direct apply from Library, unified Home custom wallpapers, '+ Add Wallpaper' button & drag-drop, card quick actions & double click |
| 2026-09-04 | Antigravity (Gemini 3.8 Flash) | Resolved main window black screen with dedicated native Win32 MPV host, sanitized WebView2 arguments |
| 2026-09-08 | Antigravity (Gemini 3.8 Flash) | Fixed missing custom wallpapers (disk persistence & auto-recovery), app/tray freeze on apply (dedicated message pump thread + transparent hit testing), and multi-monitor audio desync |
| 2026-09-08 | Antigravity (Gemini 3.8 Flash) | Resolved "localhost refused to connect" error: enabled default custom-protocol in Cargo.toml, embedded all web assets, and rebuilt standalone AetherFlow.exe |
| 2026-09-08 | Antigravity (Gemini 3.8 Flash) | Fixed multi-monitor custom video wallpaper pinning across screens and eliminated white boundary line artifact between displays |
| 2026-09-08 | Antigravity (Gemini 3.8 Flash) | Fixed multi-monitor border bleed on transition from video to canvas/image: re-asserted pin_hwnd_as_wallpaper with monitor clipping after unhiding WebView2 window |
| 2026-09-08 | Antigravity (Gemini 3.8 Flash) | Real-time audio volume/mute sync (IPC & option merge), battery & fullscreen auto-pause monitor, and native registry autostart on branch fix/audio-power-fullscreen-startup |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Fixed FPS pacing across all engines, created FPS Benchmark HUD, decoupled preview from desktop applied state to fix false display badges & Re-apply button state, restored video preview top controls, and enabled live speed/brightness/opacity on desktop wallpapers |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Built native Translucent Taskbar, YouTube & Web Stream engine, GitHub Releases auto-updater, and resolved YouTube Error 153 via strict-origin referrerpolicy & live API stream controls |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Resolved YouTube wallpaper speed multiplier control and eliminated center pause overlay buttons via debounced loop, WebView2 CSS suppression, and WS_CAPTION window style filter |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Completed frontend overhaul: eliminated YouTube 2s pause bezel via dark buffer & dual-player ping-pong crossfade, removed Resource & Memory Monitor from Settings, removed FPS display from footer |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Reverted video thumbnail previews back to zero-RAM vector placeholders to avoid high memory usage from hardware video decoders |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Removed all previews across every card (YouTube, Video, Canvas, Image), replaced hero WallpaperPlayer with glass card, dropped WebView2 RAM to ~38MB, removed 2s YouTube delay for immediate start, added --osd-level=0 to MPV to permanently remove pause symbol, and synced multi-monitor YouTube audio/video |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Fixed MPV crash caused by invalid --osd-font-size=0, restored win.emit & app.emit in main.rs, and cleaned up wallpaper.jsx listeners to restore all video, canvas, and YouTube stream wallpapers |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Restored on-demand dynamic hover previews for Video, Image, YouTube, and Canvas cards with automatic decoder disposal upon cursor exit to maintain ultra-low idle RAM |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Restored original top hero WallpaperPlayer preview banner on Home.jsx for selected/active wallpaper with rename modal & action buttons |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Fixed taskbar settings deadlock: separated mutex locking from execution, eliminated EnumWindows hangs, added DesktopWindowContentBridge bridge targets, and added SWP_FRAMECHANGED |
| 2026-09-09 | Antigravity (Gemini 3.8 Flash) | Added native open_url backend command with Windows protocol handler support, fixing TranslucentTB Microsoft Store and browser redirection |
---
*This file is maintained by AI agents. Always update the Session Log and Build Status after completing tasks.*
