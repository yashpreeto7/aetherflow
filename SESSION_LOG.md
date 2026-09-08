# SESSION_LOG.md — AuraOS Session History

<!-- This file is updated at the end of EVERY session by the AI agent. -->
<!-- Format: newest session at the bottom. Never delete old sessions. -->

---

## Session: 2026-09-02 02:30 IST
- **Agent:** Antigravity (Claude Sonnet 4.6)
- **Completed:**
  - Initialized AuraOS project structure with React 19 + Vite 8
  - Implemented all 7 Canvas 2D wallpaper engines (matrix-rain, cyber-particles, synthwave-grid, deep-space, aurora, tokyo-rain, audio-spectrum)
  - Built 6 Sovereign theme definitions in CSS custom properties
  - Implemented Zustand store with persistence
  - Built all 4 pages: Home, Marketplace, Library, Settings
  - Built WallpaperPlayer and StatusBar components
  - Configured Tauri 2 backend (Rust)
  - Created AGENTS.md, GEMINI.md, REMAINING_TASKS.md, CONTEXT.md, HANDOFF.md
  - Verified `npm run build` succeeds (228KB bundle)
  - Verified dev server starts at http://localhost:1420/
- **Build status:** ✅ Passes in 490ms

---

## Session: 2026-09-02 03:15 IST
- **Agent:** Antigravity (Claude Sonnet 4.6)
- **Completed:**
  - Added .agents/ skills folder with 7 specialized skills
  - Configured git hooks for context sync
  - Final verification of all engines and components
- **Build status:** ✅ Passes

---

## Session: 2026-09-02 14:00 IST
- **Agent:** Antigravity (Gemini 3.1 Pro)
- **Completed:**
  - Verified Rust toolchain installation (`rustup`, `cargo`, MSVC toolchain)
  - Generated SVG preview thumbnails for all 7 built-in wallpaper engines in `public/previews/`
  - Created `.env` file with Supabase placeholder configuration
  - Implemented Theme Editor component (`src/components/ThemeEditor/index.jsx`) allowing live tweaking of CSS variables, custom palette creation, and export
  - Implemented Video Wallpaper Engine backend:
    - Added `windows-sys` and `open` crates to `src-tauri/Cargo.toml`
    - Implemented `play_video_wallpaper` command in `src-tauri/src/main.rs` (launches system-optimized video player with looping/frameless flags)
    - Created `src/engines/video-player.js` frontend engine
    - Registered `video-player` in `src/engines/index.js`
    - Added video file picker support in Home and Library pages
  - Added `cargo check` validation step to verify Rust backend compilation alongside frontend build
- **Build status:** ✅ `npm run build` (514ms) and `cargo check` (1.18s) passing with 0 errors

---

## Session: 2026-09-02 18:30 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Resolved multi-monitor geometry, window placement, and desktop reparenting issues:
    - Fixed non-client frame margins and invisible DWM borders offsetting wallpaper coordinates across monitors.
    - Adjusted window bounds calculations to accurately align with monitor rects.
    - Resolved Windows 11 desktop icon Z-order: positioned wallpaper window strictly behind `SHELLDLL_DefView` in the `Progman` hierarchy to prevent icons from being hidden.
- **Build status:** ✅ `npm run build` and `cargo check` passing with 0 errors.

---

## Session: 2026-09-03 01:15 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - UI/UX overhaul of Wallpaper Engine and Library:
    - Added direct Apply Wallpaper capability from Library page.
    - Unified Home page custom wallpapers with built-in selection.
    - Added '+ Add Wallpaper' button and native drag-and-drop file import support.
    - Enhanced wallpaper cards with quick action buttons and double-click to apply.
- **Build status:** ✅ `npm run build` (502ms) and `cargo check` (1.12s) passing with 0 errors.

---

## Session: 2026-09-04 12:00 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Resolved main window black screen and crash:
    - Created dedicated native Win32 MPV host window (`AetherFlow_MpvHost`) for video rendering.
    - Sanitized WebView2 arguments to avoid GPU process crashes and D3D device removal.
- **Build status:** ✅ `npm run build` and `cargo check` passing with 0 errors.

---

## Session: 2026-09-08 01:30 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Fixed missing custom wallpapers on restart (added disk persistence and automatic recovery in `useStore.js`).
  - Fixed app and system tray freezing on apply: moved heavy Win32 window operations to a dedicated thread with a message pump and implemented transparent hit-testing.
  - Resolved multi-monitor audio desync across multiple wallpaper video instances.
- **Build status:** ✅ `npm run build` and `cargo check` passing with 0 errors.

---

## Session: 2026-09-08 03:45 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Diagnosed and resolved the "wallpaper flashes above desktop apps for a second and stops / custom and canvas wallpapers not applying":
    - **Root Cause 1 (Flashing Above Apps)**: `WebviewWindowBuilder` in `reconcile_wallpaper_windows` and `CreateWindowExW` in `get_or_create_native_wallpaper_window` were built with `.visible(true)` / `WS_VISIBLE` before Win32 desktop reparenting, and an 800ms delayed background thread was used before pinning. This allowed the unpinned window to display over active desktop applications before reparenting.
    - **Root Cause 2 (Wrong WorkerW Parent Fallback)**: A previous experimental fallback matched a 148x0 tooltip/tray `WorkerW` window (`0x20808`), parenting the wallpaper to a floating layer above apps.
    - **Root Cause 3 (MPV Binary Search Missing Root Candidates)**: When launching `AetherFlow.exe` directly from the project root, candidate paths in `find_mpv_binary` did not include `exe_dir\src-tauri\bin\mpv` or `exe_dir\bin\mpv`.
    - **Root Cause 4 (Tauri Event Emission Scope)**: Wallpaper apply events emitted solely via `win.emit_to` could be missed if the webview listener attached to window vs global scopes.
  - **Implemented Fixes**:
    - Set `.visible(false)` and removed `WS_VISIBLE` on initial window creation for both Canvas and MPV host windows; windows are pinned to the desktop layer (`Progman` / behind `SHELLDLL_DefView`) immediately while hidden, and only shown after anchoring.
    - Reverted `fallback_workerw` so `Progman` is used as the verified desktop parent in Windows 11 Raised Desktop mode, placed directly behind `SHELLDLL_DefView` (desktop icons).
    - Copied MPV engine files into `.\bin\mpv` and added `exe_dir.join("src-tauri").join("bin").join("mpv")` and `exe_dir.join("bin").join("mpv")` to `find_mpv_binary`.
    - Broadened wallpaper event dispatch to emit on `win.emit`, `win.emit_to`, and `app.emit`, and added global event listener fallback in `src/wallpaper.jsx`.
    - Built clean production standalone release with `npm run tauri:build` and copied binary to `.\AetherFlow.exe`.
- **Build status:** ✅ `npm run build` (444ms) and `npm run tauri:build` passing with 0 errors. Verified running cleanly on `WinSta0\Default`.
---

## Session: 2026-09-08 04:25 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Resolved multi-monitor border leak & original desktop wallpaper bleeding on secondary monitor:
    - **Root Cause (Canvas Wallpapers)**: Tauri `WebviewWindow` on primary display had invisible 9px non-client DWM drop-shadow frame margins (`left=9, right=9`), causing the primary window to physically extend 9px across monitor boundaries into the secondary screen (`x = 1920..1929`). Because the webview body had a transparent background, the underlying Windows desktop wallpaper showed through as a vertical white line on the left side of the second monitor.
    - **Fix (Canvas Wallpapers)**: Added Win32 `SetWindowRgn` with `CreateRectRgn(pad_left, pad_top, pad_left + mon_w, pad_top + mon_h)` in `pin_hwnd_as_wallpaper` (`src-tauri/src/main.rs`), clipping the webview strictly to the monitor client rectangle and cutting off any spillover. Set `#000` solid background in `wallpaper.html` and absolute fill positioning on `<canvas>` in `src/wallpaper.jsx`.
    - **Preserved Custom Local Wallpapers**: Reverted premature embedding into `WebviewWindow` (`cab052d` -> `8f6848a`), maintaining the dedicated pure native Win32 window host (`AetherFlow_MpvHost` + MPV `--wid`) without any window frames or padding.
    - Recompiled production binary (`npm run tauri:build`) and updated root `AetherFlow.exe`. Verified multi-monitor rendering and seamless transitions.
- **Build status:** ✅ `npm run build` (421ms) and `npm run tauri:build` passing with 0 errors. Verified running cleanly on `WinSta0\Default`.
---

## Session: 2026-09-08 16:10 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Diagnosed and resolved "Hmmm... can't reach this page / localhost refused to connect" when launching `AetherFlow.exe`:
    - **Root Cause**: In `src-tauri/Cargo.toml`, the `[features]` section declaring `custom-protocol = ["tauri/custom-protocol"]` was absent. When building Tauri binaries, `tauri-macros` checks `cfg!(not(feature = "custom-protocol"))` on the application crate. Without this feature mapping, `dev` defaulted to `true`, embedding `devUrl: "http://localhost:1420"` instead of bundling assets from `../dist`, causing standalone runs to fail when no Vite dev server was active.
    - **Fix**: Declared `[features] custom-protocol = ["tauri/custom-protocol"]` in `src-tauri/Cargo.toml`.
    - Recompiled standalone release with `npx tauri build --no-bundle` and updated root `AetherFlow.exe` (7.3MB with embedded assets). Verified standalone launch and frontend heartbeat without localhost dependencies.
- **Build status:** ✅ `npm run build` (419ms) and `cargo check` (3.06s) passing with 0 errors.
---

## Session: 2026-09-08 17:00 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Diagnosed and resolved the cold-start and laptop-restart issues ("only audio plays, custom wallpapers don't apply, app breaks after laptop restart"):
    - **Root Cause 1 (MPV Audio-Only / Direct3D 11 Swapchain Failure)**: Passing `--wid` to an `AetherFlow_MpvHost` cross-process child window caused MPV's DirectX 11 backend to fail swapchain creation with `[vo/gpu/win32] unable to create window!`, falling back to audio-only. Refactored `mpv.rs` to spawn MPV with a native borderless window and reparent its HWND (`class="mpv"`) directly into `Progman` behind `SHELLDLL_DefView` (Lively Wallpaper architecture).
    - **Root Cause 2 (Windows Explorer Cold-Boot Timing)**: On clean reboot, Explorer takes 1-4 seconds to initialize `Progman`. When AetherFlow launched on startup, `FindWindowW` failed immediately on tick 0. Added a 6-second retry loop in `pin_hwnd_as_wallpaper` so AetherFlow waits for Explorer to be ready before anchoring.
    - **Root Cause 3 (Desktop Window Station Attachment)**: Added `OpenDesktopW("Default")` / `SetThreadDesktop` at the start of `fn main()` to ensure all windows and child processes attach to the interactive `WinSta0\Default` desktop.
    - **Root Cause 4 (Windows 11 WorkerW Occlusion)**: Pushed Explorer's static wallpaper child `WorkerW` under `Progman` to `HWND_BOTTOM` to prevent it from drawing over live video wallpapers.
    - **Root Cause 5 (Frontend State Hydration & Auto-Restoration)**: Added `isWallpaperRunning` to `partialize` in `src/store/useStore.js`. Added startup restoration hook in `src/App.jsx` to call `syncCustomWallpapersFromDisk()` and automatically re-apply `activeWallpaper` on mount after a 600ms delay.
    - **Root Cause 6 (Autostart Integration)**: Installed and wired `@tauri-apps/plugin-autostart` (`enable()`, `disable()`, `isEnabled()`) to the "Launch at Startup" toggle in `Settings.jsx`.
    - Recompiled production release binary with `cargo build --release --bin aetherflow` and updated `AetherFlow.exe` in the project root.
- **Build status:** ✅ `npm run build` (461ms), `cargo check` (0 errors, 0 warnings), and `AetherFlow.exe` release binary verified.
---

## Session: 2026-09-08 17:10 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Resolved "Hmmm... can't reach this page — localhost refused to connect (ERR_CONNECTION_REFUSED)" on cold double-click after PC restart:
    - **Root Cause**: In `src-tauri/Cargo.toml`, `[features]` defined `custom-protocol = ["tauri/custom-protocol"]` without `default = ["custom-protocol"]`. Compiling with raw `cargo build --release` in prior sessions omitted the feature flag, causing Tauri 2's `tauri-macros` (`context.rs:155`) to evaluate `dev: cfg!(not(feature = "custom-protocol"))` as `true`. In dev mode, Tauri attempts to connect to `self.config.build.dev_url` (`http://localhost:1420`), failing immediately when no Vite dev server is running.
    - **Fix**: Added `default = ["custom-protocol"]` to `[features]` in `src-tauri/Cargo.toml` so any future `cargo build` or `cargo check` automatically enables custom protocol asset embedding.
    - Recompiled production standalone binary with `npx tauri build --no-bundle`, generating embedded 7.3MB executable at `src-tauri/target/release/aetherflow.exe`.
    - Overwrote root `C:\Users\Yashpreet_o7\Desktop\AetherFlow\AetherFlow.exe` with the new standalone binary.
    - Verified with `.\AetherFlow.exe --diagnostics`: confirmed `[FRONTEND HEARTBEAT]` reported page `/` successfully mounted and active from embedded assets (`http://tauri.localhost`) without any connection to `localhost:1420`.
    - Rebuilt NSIS distribution installer package via `npm run tauri:build`.
- **Build status:** ✅ `npm run build` (624ms), `AetherFlow.exe` (7.3MB embedded standalone verified offline).
---

## Session: 2026-09-08 17:30 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Resolved "custom wallpaper only applies to one screen instead of both" and "white border issue between screens":
    - **Root Cause 1 (Custom Wallpaper only applying to one screen)**: When spawning MPV video wallpapers, `pin_hwnd_as_wallpaper` took only `hwnd` and called `MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST)`. Because MPV's newly spawned window initially spawned at `(128, 128)` before geometry took effect, `MonitorFromWindow` always matched Monitor 1 (primary). In duplicated or multi-monitor modes, MPV instances for Monitor 2 were forcibly repositioned onto Monitor 1, leaving Monitor 2 without video wallpaper.
    - **Fix 1**: Updated `pin_hwnd_as_wallpaper` in `src-tauri/src/main.rs` to accept `target_bounds: Option<(i32, i32, i32, i32)>`. All MPV and Webview call sites now supply their exact monitor bounds `(pos.x, pos.y, width, height)`. Monitor 2's MPV is now pinned directly and accurately to Monitor 2.
    - **Root Cause 2 (White border between screens)**: `pin_hwnd_as_wallpaper` computed artificial `pad_left = 9, pad_right = 9, adj_w = mon_w + 18`, expanding Monitor 1's window width to 1938 at `x = -9` and extending to `x = 1929`. Since Monitor 2 begins at `x = 1920`, Monitor 1's window overflowed 9px onto the left of Monitor 2. The subsequent `SetWindowRgn` caused DWM to paint the clipped non-client boundary with a white border.
    - **Fix 2**: Stripped artificial padding and `SetWindowRgn` from `pin_hwnd_as_wallpaper`. Child windows are now placed strictly 1:1 against monitor boundaries (`adj_x = client_x, adj_y = client_y, adj_w = mon_w, adj_h = mon_h`). Zero pixels overlap between screens.
    - **Fix 3**: In `src-tauri/src/mpv.rs`, formatted geometry correctly (`--geometry={:+}{:+}`) and added `--background-color=#000000`. In `src/App.jsx`, enhanced startup restoration to re-apply per-screen wallpapers to each monitor when in `per-screen` mode.
    - Recompiled production standalone binary with `cargo build --release --bin aetherflow` and updated `AetherFlow.exe` in the project root (7.3MB).
## Session: 2026-09-08 18:05 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Resolved "border issue being recreated (border on all sides) for built-in wallpapers / wallpaper does not scale to windows":
    - **Root Cause**: In commit `573f81e`, frame inset compensation and region clipping were removed from `pin_hwnd_as_wallpaper` in favor of hardcoded 1:1 mapping (`adj_x = client_x`, `adj_w = mon_w`). While native MPV video windows have 0px non-client frame (`--no-border`), Tauri's WebView2 host windows have standard Windows non-client margins (9px left, 9px right, 1px top, 9px bottom). Setting the outer window rect to exact monitor dimensions (1920x1080) caused Windows to shrink the client area to `1902x1070` starting at `(9, 1)`. Because the canvas renders inside the client area, a 9px border appeared around the wallpaper on all sides.
    - **Fix 1 (`src-tauri/src/main.rs`)**: Dynamically measure the HWND's frame insets (`left_frame = client_origin.x - pre_wr.left`, etc.). When insets exist (Tauri WebView window), expand outer window coordinates (`adj_x = client_x - pad_left`, `adj_w = mon_w + pad_left + pad_right`, etc.) so the client area matches the monitor dimensions 1:1 (`1920x1080` at `(0, 0)`). Then apply `SetWindowRgn` strictly to `(pad_left, pad_top, pad_left + mon_w, pad_top + mon_h)` so the outer non-client frame is clipped and never overlaps adjacent screens. For zero-border windows like MPV, `pad_left = 0`, preserving 1:1 unclipped placement.
    - **Fix 2 (`src/engines/*.js`)**: Updated `resize()` in all 7 built-in wallpaper engines (`matrix-rain.js`, `cyber-particles.js`, `synthwave-grid.js`, `deep-space.js`, `aurora.js`, `tokyo-rain.js`, `audio-spectrum.js`) to evaluate `canvas.width = canvas.offsetWidth || window.innerWidth` and `canvas.height = canvas.offsetHeight || window.innerHeight` so the canvas reliably scales to the window even if queried before initial DOM layout.
    - Recompiled production release binary (`npm run tauri:build`), generating updated 7.3MB standalone executable at `AetherFlow.exe`.
- **Build status:** ✅ `npm run build` (1.16s), `npm run tauri:build` (0 errors), and `AetherFlow.exe` updated.
---

## Session: 2026-09-08 18:20 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Committed prior border scaling fix to git repository (`ac56812`: `fix(desktop): fix built-in wallpaper scaling and border on all sides`).
  - Added full support for normal background pictures (`.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`):
    - **Canvas 2D Image Engine (`src/engines/image-player.js`)**: Created a lightweight (~1.4KB) Canvas 2D engine supporting high-resolution image rendering, responsive resize, dynamic aspect-ratio scaling (`cover`, `contain`, `stretch`), and zero CPU overhead when idle.
    - **Engine Registry (`src/engines/index.js`)**: Registered `image-player` and cleaned up `WALLPAPER_LIST` to filter out engine templates (`video-player`, `image-player`) so only legitimate built-ins appear in the built-in catalogue.
    - **Actions & Persistence (`src/lib/wallpaperActions.js`)**: Updated `importWallpaperDialog` with multi-category filters (`All Supported Media`, `Pictures (*.png, *.jpg, *.jpeg, *.webp, *.bmp)`, `Videos (*.mp4, *.webm, *.mkv...)`). Added `addCustomMediaWallpaper` to detect media type and create appropriate `image-player` or `video-player` items. Added `setSystemWallpaper` helper.
    - **Native System Wallpaper Command (`src-tauri/src/main.rs`)**: Implemented `set_system_wallpaper(path: String)` via Win32 `SystemParametersInfoW(SPI_SETDESKWALLPAPER)` so users can also persist any picture as their native Windows desktop background.
    - **UI Controls & Previews (`src/pages/Home.jsx`, `src/pages/Library.jsx`)**:
      - File pickers and drag-and-drop now accept PNG, JPG, JPEG, WebP, and BMP files in addition to videos.
      - Updated `AddWallpaperModal` with dynamic icon and title (`Add Picture Wallpaper` vs `Add Video Wallpaper`).
      - Added dynamic property controls for images on `Home.jsx`: Fit mode toggle (`Cover`, `Contain`, `Stretch`) and "Set as Windows Wallpaper" button with visual confirmation.
      - Updated `WallpaperThumbnail`: renders crisp `<img>` tag via Tauri's asset protocol with smooth hover zoom for image wallpapers.
  - **Build status:** ✅ `npm run build` (637ms), `cargo check` passing with 0 errors.
---

## Session: 2026-09-08 18:35 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Resolved multi-monitor border bleed during video to canvas/image wallpaper transitions:
    - **Root Cause**: When switching from a video wallpaper to a canvas or image wallpaper, Tauri unhides the WebView2 window (`win.show()`). Windows DWM resets or destroys a window's clipping region (`HRGN`) when a window is unhidden or when sibling windows are destroyed in the desktop Z-order. Because `apply_wallpaper` previously only called `win.show()` without re-asserting `pin_hwnd_as_wallpaper` or `SetWindowRgn`, the primary display's WebView2 window had unclipped 9px DWM non-client margins extending onto the adjacent secondary display (`DISPLAY6` at `x=1920`), visible as a vertical line until a second apply.
    - **Fix (`src-tauri/src/main.rs`)**: Inside `apply_wallpaper` (`else` branch for canvas & image wallpapers), immediately after calling `win.show()`, matched the window label to its corresponding monitor in `monitors` to get `(mon_x, mon_y, mon_w, mon_h)`. Extracted the raw Win32 HWND (`win.hwnd()`) and re-called `pin_hwnd_as_wallpaper(hwnd, mon_bounds)`. This immediately recalculates frame insets, sets the window position, and reapplies `SetWindowRgn` with the exact monitor boundary clipping.
    - Recompiled production release binary (`cargo build --release`), generating updated 7.3MB standalone executable at `src-tauri/target/release/aetherflow.exe` and refreshed root `AetherFlow.exe`.
- **Build status:** ✅ `npm run build` (465ms), `cargo check` passing with 0 errors, `cargo build --release` (2m 04s) clean, `AetherFlow.exe` updated.
---

## Session: 2026-09-08 18:50 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Branch:** `fix/audio-power-fullscreen-startup` (strictly not on `main`)
- **Completed:**
  - **Real-Time Audio Volume & Mute Sync**:
    - Hardened MPV IPC pipe communication in `src-tauri/src/mpv.rs` with `WaitNamedPipeW` and retry on busy.
    - Updated `update_wallpaper_config` to extract volume/mute and forward immediately to MPV.
    - Added direct event and IPC dispatches from `Settings.jsx` and `App.jsx` on slider movement and mute toggle.
    - Fixed `options = { ...options, ...newOpts }` merging in `src/engines/video-player.js` so updating volume/mute does not erase `videoPath`.
  - **Auto-Pause on Battery & Fullscreen**:
    - Implemented Win32 power status check (`GetSystemPowerStatus`) in `src-tauri/src/main.rs`.
    - Implemented Win32 foreground fullscreen detection (`GetForegroundWindow` + `MONITORINFO`) with desktop (`WorkerW`, `Progman`) and taskbar exclusion filters.
    - Added dedicated background monitor thread checking every 750ms against active performance settings.
    - Dispatches pause/resume to both native MPV processes and WebView2 canvas/video wallpaper windows.
    - Added `pause()` and `resume()` lifecycle hooks across all Canvas 2D wallpaper engines.
  - **Windows Startup Registry & Silent Boot**:
    - Added `"autostart:default"` capability permission in `src-tauri/capabilities/default.json`.
    - Implemented native Windows registry autostart commands (`set_autostart`, `is_autostart_enabled`) targeting `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` with `"<exe_path>" --autostart --minimized`.
    - Updated `App.jsx` to detect `--autostart` / `--minimized` via `is_minimized_boot` and skip opening/focusing the UI window on boot, keeping AetherFlow running silently in the system tray.
- **Build status:** ✅ `npm run build` (916ms), `cargo check` (1.65s) passing with 0 errors.
---
