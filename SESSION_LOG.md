# AuraOS Session Log
<!-- Append a new entry at the end of every session. -->
<!-- Format: see .agents/skills/context-sync/SKILL.md -->

---

## Session: 2026-09-02 12:38 IST
- **Agent:** Antigravity (Claude Sonnet 4.6 via Antigravity IDE)
- **Duration:** ~45 minutes
- **Completed:**
  - Full frontend built: 7 wallpaper engines, 6 themes, 4 pages, 2 components
  - Tauri 2 Rust backend configured (main.rs, Cargo.toml, tauri.conf.json)
  - Vite build verified: ✅ 409ms, 0 errors
  - Dev server verified: ✅ http://localhost:1420/
  - .agents/ skills installed: planning-with-files, subagent-driven-development, verification-loop, impeccable, ui-ux-pro-max, to-spec
  - AGENTS.md (14KB) written for less-capable model handoff
  - GEMINI.md rewritten with explicit session-start sequence
  - REMAINING_TASKS.md with step-by-step instructions per task
  - CONTEXT.md (this living file) created
  - SESSION_LOG.md (this file) created
  - hooks.json created for auto context-flushing
  - context-sync skill created
- **Build status:** ✅ `npm run build` passes in ~409ms
- **Next session should:** Install Rust (`winget install Rustlang.Rustup`) then run `npm run tauri:dev` — see REMAINING_TASKS.md Task 1

## Session: 2026-09-02 22:40 IST
- **Agent:** Antigravity (Gemini 3.8 Flash / Claude Sonnet)
- **Completed:**
  - Resolved multi-monitor geometry and DWM invisible non-client frame margin offset (eliminated left gap & right monitor spill)
  - Implemented dynamic frame inset measurement via `MapWindowPoints` (eliminated top edge gap)
  - Fixed Windows 11 desktop Z-order by parenting to Progman and placing directly behind `SHELLDLL_DefView` (desktop icons remain on top of live wallpaper)
  - Resolved WebView2 rendering pipeline and restored proper IPC event routing
  - Pushed codebase to GitHub repository: https://github.com/yashpreeto7/Wallgine
- **Build status:** ✅ `cargo check` and `npm run build` passing with 0 errors
- **Result:** Live wallpaper embedding and geometry verified working by user.

## Session: 2026-09-03 14:58 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Duration:** ~25 minutes
- **Completed:**
  - Implemented Wallpaper Engine-inspired UI/UX overhaul requested by user:
    - Enabled direct desktop application of wallpapers from Library (no need to navigate back to Home).
    - Unified custom user-imported video wallpapers into the Home page grid alongside built-in engines.
    - Added "+ Add Wallpaper" button and file drag-and-drop on both Home and Library pages.
    - Added double-click to apply wallpaper immediately to desktop.
    - Added hover overlay action buttons on wallpaper cards.
    - Added category filter pills (All, Built-in Canvas, Videos & Custom) and search filter on Home.
    - Added live pulsating green status badges and monitor targeting support in Library.
    - Created centralized `src/lib/wallpaperActions.js` dispatcher.
- **Build status:** ✅ `npm run build` and `cargo check` passing with 0 errors
## Session: 2026-09-03 15:05 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Duration:** ~10 minutes
- **Completed:**
  - Resolved black previews issue:
    - Fixed `engineId` fallback (`wallpaper.engine || wallpaper.id`) so built-in engines are never passed as `undefined`.
    - Initialized canvas dimensions with non-zero fallbacks before engine boot to prevent 0-pixel canvases.
    - Updated video preview element with `playsinline`, `muted`, `preload="auto"`, `zIndex: 1`, and frame seek to eliminate black video containers.
  - Implemented Wallpaper Naming & Renaming:
    - Created `AddWallpaperModal` to name custom wallpapers during file import or drag-and-drop, with option to pin to Home.
    - Created `RenameWallpaperModal` with pencil icon buttons on all cards to rename any wallpaper.
  - Established Library as Master Repository & Home as Curated Dashboard:
    - Library contains ALL wallpapers (built-ins + customs) with Pin to Home toggles.
    - Home displays ONLY curated/pinned favorite wallpapers with quick unpin actions and "Manage in Library" link.
## Session: 2026-09-03 15:35 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Duration:** ~15 minutes
- **Completed:**
  - Resolved 1GB - 2.5GB memory consumption and memory leak on scroll:
    - Root cause 1: 15+ concurrent 60 FPS `requestAnimationFrame` canvas loops and hardware video decoders were running simultaneously across all thumbnail cards.
    - Root cause 2: `WallpaperPlayer` had an asynchronous race condition where unmounting while `descriptor.load()` was in flight leaked orphaned animation loops that never stopped on scroll.
    - Added `bootSeqRef` and `isMountedRef` to `WallpaperPlayer` to guarantee orphaned animation loops are aborted and stopped.
    - Created `WallpaperThumbnail` component: replaces heavy live engine loops in grid cards with zero-CPU vector SVG previews for built-ins, and paused/hover-only poster frames for videos.
    - Live 60 FPS animation loop is now reserved exclusively for the Selected Wallpaper Hero.
## Session: 2026-09-03 16:55 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Duration:** ~15 minutes
- **Completed:**
  - Diagnosed Windows Task Manager process grouping and optimized process count:
    - Explained why Windows 11 Task Manager groups child renderers under "WebView2 Manager" (Microsoft's system binary `msedgewebview2.exe` metadata).
    - Added Chromium/WebView2 browser flags `--disable-features=AudioServiceOutOfProcess` and `--disable-crash-reporter` to merge audio service and remove crashpad process.
    - Switched wallpaper window creation from eager launch-time pre-creation to on-demand creation upon wallpaper application.
    - Added `EmptyWorkingSet(GetCurrentProcess())` when minimizing/closing control panel to system tray to reclaim unused memory down to ~15MB.
## Session: 2026-09-03 17:02 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Duration:** ~5 minutes
- **Completed:**
  - Resolved "wallpaper does not apply and white window pops up on second screen":
    - Identified that creating wallpaper windows on-demand during `apply_wallpaper` caused a race condition where `aura:set-engine` was emitted before `wallpaper.html` loaded React and registered listeners, leaving a top-level unpinned white window.
    - Restored `ensure_wallpaper_windows` inside `setup()` so windows are created, transparency is applied, and windows are safely pinned behind desktop icons before any apply action occurs.
    - Verified `npm run build` (477ms) and `cargo check` (6.07s) pass with 0 errors.
## Session: 2026-09-03 17:07 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Duration:** ~5 minutes
- **Completed:**
  - Resolved "desktop app disappear and we dont have an option to stop wallpaper":
    - Added universal, persistent "Stop Wallpaper" button to `StatusBar/index.jsx` anchored at the bottom of every page with live pulsing status badge.
    - Updated `src-tauri/src/main.rs` tray event listener to support single-click and double-click to immediately unminimize and focus the control panel.
    - Removed duplicate `onCloseRequested` JS event listener from `App.jsx` to prevent window hiding race conditions.
    - Killed lingering hidden background process so fresh `npm run tauri:dev` runs cleanly.
- **Build status:** ✅ `npm run build` (497ms) and `cargo check` (1.10s) passing with 0 errors

## Session: 2026-09-03 17:28 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Duration:** ~15 minutes
- **Completed:**
  - Diagnosed and resolved the runtime display change / hot-plug bug:
    - Root cause: Hot-plugged second monitor was not pre-initialized on display extend; when user clicked "Apply", `WebviewWindowBuilder` was invoked on the fly, emitting `aura:set-engine` before `wallpaper.html` finished loading React, dropping the event and leaving an unpinned white window.
    - Added reactive background display change & hot-plug watcher in `src-tauri/src/main.rs`: automatically detects monitor additions/removals every 800ms and executes the EXACT working startup code path (`ensure_wallpaper_windows`) to create, pin, and initialize the wallpaper host for the new monitor.
    - Implemented clean monitor teardown on disconnect (`win.destroy()`) to prevent stale/invalid HWND reuse on reconnect.
    - Added thread-safe `ACTIVE_WALLPAPERS` cache and `get_monitor_active_wallpaper` IPC query in `wallpaper.jsx` to completely eliminate race conditions between window loading and wallpaper application.
    - Added user-specified logging in stdout and `desktop_debug.log`: `[DISPLAY CHANGE]`, `[NEW MONITOR]`, `[WALLPAPER HOST]`.
    - Updated `Home.jsx` and `Library.jsx` to listen for `aura:monitors-changed` to automatically update monitor selectors.
- **Build status:** ✅ `npm run build` (424ms) and `cargo check` (1.95s) passing with 0 errors

## Session: 2026-09-03 17:42 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Duration:** ~15 minutes
- **Completed:**
  - Resolved border strip visual artifacts during `PC screen only ↔ Extend` display topology transitions:
    - Root cause: On display topology change, only removed/new windows were handled; existing wallpaper hosts were skipped, leaving them anchored to outdated desktop bounds/z-order without DWM redraw.
    - Implemented debounced and coalesced display topology watcher: samples monitors and waits for two consecutive identical samples (300ms apart) to ensure Windows display settling before reconciling.
    - Implemented full 10-step controlled wallpaper reconciliation in `src-tauri/src/main.rs`:
      1. Keeps existing valid wallpaper hosts alive.
      2. Destroys wallpaper HWNDs/WebViews ONLY for disconnected monitors (with `ShowWindow(SW_HIDE)`, `SetParent(NULL)`, and `DestroyWindow(HWND)` to prevent orphaned Win32 handles).
      3. Creates hosts for newly added monitors using the exact working startup path.
      4. Recalculates existing hosts with their updated `rcMonitor`, re-parenting, and re-applying `SetWindowPos`.
      5. Forces immediate DWM and desktop invalidation/redraw via `InvalidateRect`, `UpdateWindow`, and `RedrawWindow` (`RDW_INVALIDATE | RDW_UPDATENOW | RDW_ERASE | RDW_ALLCHILDREN`).
      6. Verifies and logs `[WALLPAPER STATE]` (host count == monitor count invariant).
- **Build status:** ✅ `npm run build` (467ms) and `cargo check` (2.23s) passing with 0 errors

## Session: 2026-09-03 19:30 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Duration:** ~15 minutes
- **Completed:**
  - Optimized memory consumption to match or beat Lively Wallpaper (~250-300MB total across dual monitors):
    - **Chromium / WebView2 Process Flags**: Injected `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` (`--process-per-site`, `--renderer-process-limit=2`, disabled out-of-process audio and non-essential services, set `--js-flags="--max-old-space-size=64"`, and capped disk/media cache to 2MB).
    - **Deep Working-Set Trimming (Host + All Child WebView2s)**: Implemented Win32 `trim_all_process_memory()` using `CreateToolhelp32Snapshot` to find and call `EmptyWorkingSet` on the host and all child `msedgewebview2.exe` processes upon minimize/close to tray, stop wallpaper, and periodically every 45s.
    - **Hover-Only Video Decoder Mounting**: Refactored `WallpaperThumbnail` so `<video>` hardware decoders are mounted ONLY when actively hovered over, eliminating the Direct3D decoder memory accumulation when scrolling through custom video wallpapers.
    - **Auto-Pause Preview**: Added `visibilitychange` listener in `WallpaperPlayer` to pause animations when window is minimized or hidden.
- **Build status:** ✅ `npm run build` (575ms) and `cargo check` (0.48s) passing with 0 errors

## Session: 2026-09-03 20:00 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Duration:** ~25 minutes
- **Completed:**
  - Created experimental feature branch `feat/mpv-wallpaper-engine` to build an MPV-only video wallpaper backend for AuraOS.
  - Downloaded and extracted standalone portable `mpv.exe` (v0.41.0) into `src-tauri/bin/mpv/` with `.gitignore` configuration.
  - Implemented `src-tauri/src/mpv.rs` managing MPV process lifecycle, `--wid` native HWND embedding into desktop layer (`WorkerW`), and named pipe IPC (`\\.\pipe\auraos-mpv-<label>`).
  - Integrated modular wallpaper router in `src-tauri/src/main.rs`:
    - Video wallpapers (`.mp4`, `.webm`, `.mkv`, `.avi`, `video-player`) route to MPV child processes (one per active video monitor).
    - Canvas wallpapers continue using WebView2.
    - Stopping / switching wallpapers completely terminates the corresponding MPV process and releases its native resources.
    - Display topology changes cleanly clean up MPV processes for removed monitors.
  - Executed required memory & resource benchmarking comparing MPV against WebView2 on the exact same video file (`elden-ring-throne-of-ashes...`):
    - Baseline AuraOS: 167.96 MB
    - Video wallpaper using MPV: 275.38 MB (1 MPV process, 220.16 MB, ~0.8% CPU)
    - Stop MPV: 168.10 MB (0 MPV processes remaining)
    - Restart AuraOS: 167.60 MB
    - Achieved ~70% RAM reduction compared to previous WebView2 video decoding (~1GB).
- **Build status:** ✅ `npm run build` (460ms), `cargo check` (1.07s), and `cargo build` (12.88s) passing with 0 errors
- **Git:** Committed and pushed to `origin/feat/mpv-wallpaper-engine`

## Session: 2026-09-04 16:10 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Diagnosed and fixed the main AuraOS application window black screen issue after applying MPV video wallpapers:
    - Root Cause 1: Direct3D/DXGI swapchain collision caused by MPV rendering directly to the WebView2 wallpaper window's HWND (`win.hwnd()`), throwing `DXGI_ERROR_DEVICE_REMOVED` in WebView2's GPU compositor.
    - Root Cause 2: Chromium flags `--process-per-site` and `--renderer-process-limit=2` in `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` forced the main UI window and wallpaper windows to share the same GPU and renderer process, causing the main window to go black when the wallpaper GPU context crashed.
    - Root Cause 3: `--js-flags="--max-old-space-size=64"` choked the V8 heap, causing silent OOM crashes.
  - Implemented dedicated native Win32 windows (`AuraOS_MpvHost`) for MPV via `CreateWindowExW`, completely bypassing and isolating WebView2 for video playback.
  - Added thread-safe `MAIN_HWND` tracker and critical assertion `is_main_hwnd(hwnd)` in `pin_hwnd_as_wallpaper` with `[DIAG 10 CRITICAL REJECT]` to ensure the main window can never be reparented or targeted.
  - Refactored `apply_wallpaper` to be asynchronous and spawn MPV on background tasks, preventing Tauri main UI thread blocking.
  - Sanitized WebView2 arguments (removed process-sharing and heap-throttling flags, increased cache sizes to 16MB).
  - Added comprehensive diagnostics (`[DIAG 1]` through `[DIAG 10]`) in backend, plus frontend lifecycle telemetry and 2-second heartbeat loop in `src/main.jsx`.
  - Fully executed repeated cold restart test sequence: verified main window survived repeated cold starts and MPV wallpaper applications with active heartbeats (`visibility=visible, mounted=true`) and `parent: 0x0`.
- **Build status:** ✅ `npm run build` (394ms), `cargo check` (1.83s), and `cargo build` passing with 0 errors
---

## Session: 2026-09-08 01:22 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Resolved missing local wallpapers:
    - Added automatic migration from legacy `auraos-state` to `aetherflow-state` in `localStorage`.
    - Added persistent storage to `%APPDATA%/AetherFlow/custom_wallpapers.json` via new Tauri commands `save_custom_wallpapers` and `load_custom_wallpapers`.
    - Implemented startup auto-recovery for all 9 downloaded custom wallpapers (Goku, Kid Goku, Sabrina Carpenter, Elden Ring, The Batman, Vegeta, Itachi, Furina).
  - Resolved app & tray freeze after applying wallpaper:
    - Spawned native MPV desktop host window on a dedicated Win32 thread running its own `GetMessageW` / `DispatchMessageW` message loop.
    - Updated `wallpaper_wnd_proc` to return `HTTRANSPARENT` on `WM_NCHITTEST` and `MA_NOACTIVATE` on `WM_MOUSEACTIVATE`, and added `WS_EX_TRANSPARENT` so mouse clicks pass directly through to desktop icons.
    - Changed `ShowWindow(SW_SHOW)` to `SW_SHOWNOACTIVATE` to prevent focus stealing.
    - Added 50ms non-blocking check (`WaitNamedPipeW`) for named pipe IPC in `mpv.rs` so IPC never deadlocks the UI thread.
    - Bypassed redundant 550ms WorkerW search sleep loop when Progman already hosts `SHELLDLL_DefView`.
  - Resolved out-of-sync duplicate audio on multi-monitor setups:
    - Configured `apply_wallpaper` to play audio strictly on the primary/first monitor while muting secondary monitors in duplicate mode.
    - Linked user volume and mute options from configuration to MPV process instances.
  - Recompiled release binary and updated `AetherFlow.exe` (7.1MB) in root directory.
- **Build status:** ✅ `npm run build` (751ms) and `cargo build --release` (0 errors) verified.
---

## Session: 2026-09-08 01:40 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Diagnosed and resolved memory leak during continuous wallpaper switching (WebView2 GPU Process taking 725.6MB):
    - Root Cause 1: `trim_all_process_memory()` was only searching direct child processes, skipping grandchild processes (GPU Process, Renderers, Utilities) spawned by the WebView2 broker.
    - Root Cause 2: Moving the mouse across cards in `WallpaperThumbnail` mounted `<video autoPlay ...>` elements that detached upon unhover before cleanup could run, leaking hardware D3D11 decoding surfaces.
    - Root Cause 3: `loadVideo` in `video-player.js` assigned new sources without tearing down existing streams.
    - Root Cause 4: Desktop WebView2 wallpaper windows maintained full-resolution canvas swapchains in the GPU process while MPV was playing video.
  - Implemented comprehensive fixes:
    - Rewrote `trim_all_process_memory()` in `src-tauri/src/main.rs` using recursive BFS PID tree traversal to trim all descendants (host, broker, GPU process, renderers, MPV).
    - Added 180ms hover debounce and guaranteed callback ref teardown (`pause()`, `removeAttribute('src')`, `.load()`) in `WallpaperThumbnail`.
    - Added pre-assignment media teardown and `preload="metadata"` in `video-player.js`.
    - Shrunk desktop WebView2 canvases to 1x1 on `aura:stop` to free GPU framebuffers.
    - Added post-apply delayed trim in `apply_wallpaper` and a 45s periodic background compaction loop.
    - Added `--enable-features=TrimOnMemoryPressure` and `--disable-gpu-memory-buffer-video-frames` to WebView2 flags.
    - Added `bin/` and `*.exe` to `.gitignore`.
  - Rebuilt production release binary (`npm run tauri:build`) and verified live metrics.
- **Verification & Benchmark Results:**
  - WebView2 GPU Process RAM dropped from **725.6 MB down to 19.6 MB**.
  - Total application suite RAM dropped from **957 MB down to ~80 MB** (91% reduction).
---

## Session: 2026-09-08 02:30 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Resolved unexpected microphone permission prompt ("tauri.localhost wants to Use your microphones"):
    - Isolated cause to `audio-spectrum.js` running `navigator.mediaDevices.getUserMedia({ audio: true })` synchronously inside `start()`.
    - Set `useMic: false` by default in `src/engines/index.js` and `src/engines/audio-spectrum.js`.
    - Made the render loop start immediately using beat simulation without blocking on audio permissions.
    - Made microphone reactivity opt-in through configuration; initializations now occur asynchronously in the background with graceful fallback on denial.
  - Resolved issue with wallpapers not displaying on desktop (desktop occlusion bug):
    - Identified that `pin_hwnd_as_wallpaper` in `src-tauri/src/main.rs` skipped sending `0x052C` to `Progman` when `progman_shell` was detected, failing to spawn the Windows `WorkerW` background layer and placing wallpaper windows directly inside `Progman` where Windows 11 wallpaper drawing covered them.
    - Updated `pin_hwnd_as_wallpaper` to always send message `0x052C` to `Progman` and prioritize `WorkerW` as the wallpaper host parent.
    - Enhanced `enum_window` and `DesktopWindows` with fallback detection for standalone `WorkerW` instances.
- **Build status:** ✅ `npm run build` (435ms) and `cargo check` (0 errors) passing.
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

## Session: 2026-09-08 04:00 IST
- **Agent:** Antigravity (Gemini 3.8 Flash)
- **Completed:**
  - Diagnosed and fixed the white vertical border artifact on the second monitor when applying custom wallpapers:
    - **Root Cause**: `pin_hwnd_as_wallpaper` in `src-tauri/src/main.rs` applied an artificial frame padding (`pad_left = 9`, `pad_right = 9`, `adj_w = mon_w + 18`). For Monitor 1 (1920x1080) at x=0, this expanded the window width to 1938 and positioned it at x=-9, extending its right edge to x=1929. Monitor 2 starts at x=1920, so Monitor 1's window overflowed by 9 pixels over Monitor 2. Because the wallpaper canvas content only rendered up to 1920, the overlapping non-client border area showed up as a white vertical stripe on Monitor 2.
    - **Fix 1 (`src-tauri/src/main.rs`)**: Removed artificial border padding calculations from `pin_hwnd_as_wallpaper`. The child window is mapped 1:1 to exact monitor pixel boundaries (`adj_x = client_x`, `adj_y = client_y`, `adj_w = mon_w`, `adj_h = mon_h`). Monitor 1 ends at 1920 and Monitor 2 begins at 1920 with zero overlap.
    - **Fix 2 (`src-tauri/src/mpv.rs`)**: Added `--no-border` and `--background-color=#000000` to MPV startup parameters to prevent MPV from drawing any internal window frame or default white background.
    - **Fix 3 (`wallpaper.html`)**: Explicitly styled `html, body { background: #000; }` so that any unrendered areas fallback to pure black instead of the browser default white.
  - Rebuilt production release binary (`npm run tauri:build`), updated `AetherFlow.exe`, and launched on `WinSta0\Default`.
  - Pushed all commits to GitHub branch `dev`.
- **Build status:** ✅ `npm run build` (449ms) and `npm run tauri:build` passing with 0 errors.
---
