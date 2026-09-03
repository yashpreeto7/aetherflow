# AuraOS — Living Context File
<!-- AUTO-UPDATED: This file is rewritten at the end of every session. -->
<!-- If you are an AI agent, read this file FIRST before doing anything. -->

## Last Updated
2026-09-03 14:58 IST — Session: Wallpaper Engine-style UI/UX overhaul (direct apply from Library, unified Home grid, + Add Wallpaper, double click)

---

## What AuraOS Is

A **standalone Windows desktop application** that:
- Shows **live animated wallpapers** behind the Windows desktop (like Wallpaper Engine)
- Lets users switch **themes** (6 Sovereign themes built-in)
- Has a **marketplace** for community wallpapers/themes (Supabase)
- Is **ultra-lightweight**: ~8MB install, ~30MB RAM (uses WebView2, not Chromium)

**Location:** `C:\Users\Yashpreet_o7\Desktop\AURAOS\`
**NOT related to:** `C:\Users\Yashpreet_o7\Desktop\PERSONALAGENT\` (different project, don't touch)

---

## Build Status

| Check | Result |
|-------|--------|
| `npm run build` | ✅ Passes in ~400ms |
| `npm run dev` | ✅ Runs at http://localhost:1420/ |
| `npm run tauri:dev` | ❌ Not yet tested (needs Rust installed) |
| Windows .exe installer | ❌ Not yet built |

---

## Architecture Decisions (PERMANENT — Do Not Change)

| Decision | Choice | Reason |
|----------|--------|--------|
| Desktop framework | **Tauri 2** (NOT Electron) | 8MB vs 150MB, 30MB RAM vs 300MB |
| Frontend | **React 19 + Vite 8** | Fast HMR, tree-shaking |
| State | **Zustand** with persist | Simple, localStorage-backed |
| Wallpaper rendering | **Canvas 2D only** | Lightweight, no GPU dep |
| Marketplace backend | **Supabase** (free tier) | Auth + DB + Storage |
| Minifier | **oxc** | Vite 8 dropped esbuild |
| manualChunks | **Function form** | rolldown requirement |
| Wallpaper pinning | **Frameless Tauri window** | Simpler than COM API |

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
src/engines/index.js                Lazy-loaded engine registry + theme list
src/store/useStore.js               Zustand persisted global state
src/styles/themes.css               6 Sovereign theme CSS token sets
src/styles/index.css                Global CSS utilities
src/components/WallpaperPlayer/     Engine lifecycle manager (canvas)
src/components/StatusBar/           Waybar-style FPS + status bar
src/lib/supabase.js                 Offline-safe Supabase marketplace API
src/pages/Home.jsx                  Wallpaper grid, controls, theme switcher
src/pages/Marketplace.jsx           Search, tags, publish form
src/pages/Library.jsx               Installed items, activate/uninstall
src/pages/Settings.jsx              FPS, audio, glassmorphism, system
src/App.jsx                         Router, sidebar, wallpaper layer, layout
src/main.jsx                        Entry point, theme hydration
src-tauri/src/main.rs               Rust backend: window mgmt, tray, commands
src-tauri/Cargo.toml                Release: lto + strip + opt-level=s
src-tauri/tauri.conf.json           System tray, NSIS installer config
vite.config.js                      Tauri-optimized, oxc minifier
package.json                        Scripts: dev, build, tauri:dev, tauri:build
AGENTS.md                           Full agent instructions (14KB)
GEMINI.md                           Gemini-specific session start rules
REMAINING_TASKS.md                  Step-by-step remaining task guide
HANDOFF.md                          Session handoff with full status
.agents/skills/auraos-resume/       Project context loader skill
.agents/skills/planning-with-files/ Task persistence across sessions
.agents/skills/subagent-driven*/    Parallel task execution skill
.agents/skills/verification-loop/   Post-feature verification skill
.agents/skills/impeccable/          UI polish skill
.agents/skills/ui-ux-pro-max/       UI/UX intelligence skill
.agents/skills/to-spec/             Turn ideas into precise specs
.agents/rules/auraos-standards.md   Engine, Supabase, Zustand patterns
public/previews/*.svg               Fallback preview thumbnails generated
.env file                           Supabase config scaffolded
Theme Editor component              Visual CSS token editor built and integrated
Video wallpaper engine              MP4/WebM backend command and frontend player
```

### ❌ Not Done
```
Supabase DB tables                   marketplace SQL (optional)
npm run tauri:build                  Windows .exe installer (optional)
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

---
*This file is maintained by AI agents. Always update the Session Log and Build Status after completing tasks.*
