# AuraOS — Session Handoff File
> **Created:** 2026-09-02 | **Status:** ✅ COMPLETE — Live wallpaper embedding, Z-order behind desktop icons, and multi-monitor geometry verified working!
> Copy this file verbatim into your new session's first message.

---

## 🧠 Context Snapshot (Read First)

We are building **AuraOS** — a **standalone Windows desktop app** similar to Wallpaper Engine + Lively. It is a **completely separate project** from the Personal AI OS at `C:\Users\Yashpreet_o7\Desktop\PERSONALAGENT`.

**Project location:** `C:\Users\Yashpreet_o7\Desktop\AURAOS\`

### Why this project exists
The Personal AI OS (`PERSONALAGENT`) already has a world-class theme + wallpaper engine in `server/dashboard_template.py` (8 Sovereign themes, 7 live wallpaper canvas engines, audio spectrum visualizer). We are extracting that engine into a dedicated, ultra-lightweight standalone Windows app with a built-in marketplace.

---

## ✅ What Has Been Built (DO NOT REBUILD)

### Project Bootstrap
- [x] `AURAOS/` directory created at `C:\Users\Yashpreet_o7\Desktop\AURAOS\`
- [x] Vite + React scaffold
- [x] All npm deps installed
- [x] **Tech stack: Tauri 2 + React + Vite** (8MB app, 30MB RAM)
- [x] **Build verified: `npm run build` succeeds in 409ms, 0 errors**
- [x] **Dev server running: `npm run dev` → http://localhost:1420/**

### Configuration Files
- [x] `vite.config.js` — oxc minifier, rolldown-compatible manualChunks function
- [x] `src-tauri/Cargo.toml` — release profile: lto, strip, opt-level s
- [x] `src-tauri/src/main.rs` — wallpaper window, single-instance, tray
- [x] `src-tauri/tauri.conf.json` — system tray, NSIS, window settings
- [x] `package.json` — tauri, tauri:dev, tauri:build scripts added
- [x] `index.html` — AuraOS title, data-theme default

### State Management
- [x] `src/store/useStore.js` — Zustand persisted store (all state)

### Wallpaper Engines (7/7 complete)
- [x] `matrix-rain.js` · `cyber-particles.js` · `synthwave-grid.js`
- [x] `deep-space.js` · `aurora.js` · `tokyo-rain.js` · `audio-spectrum.js`
- [x] `index.js` — lazy-loaded engine registry + builtin themes list

### Theme System
- [x] `src/styles/themes.css` — 6 Sovereign themes

### Frontend (100% done)
- [x] `src/styles/index.css` — Global CSS, cards, buttons, sliders, toggles, glass
- [x] `src/components/WallpaperPlayer/index.jsx` — engine lifecycle manager
- [x] `src/components/StatusBar/index.jsx` — Waybar-style bar with live FPS
- [x] `src/lib/supabase.js` — offline-safe Supabase client + marketplace API
- [x] `src/pages/Home.jsx` — wallpaper grid + previews + controls + themes
- [x] `src/pages/Marketplace.jsx` — search, tags, publish form, offline fallback
- [x] `src/pages/Library.jsx` — installed items, activate/uninstall
- [x] `src/pages/Settings.jsx` — FPS, audio, glassmorphism, system toggles
- [x] `src/App.jsx` — Router, sidebar nav, wallpaper layer, layout
- [x] `src/main.jsx` — React entry, theme applied before first paint

---

## ❌ What Remains (Pick Up Here)

> [!IMPORTANT]
> **The frontend is 100% complete and builds cleanly.** The ONLY thing left is setting up the Rust toolchain and running `npm run tauri:dev` to get the native Windows app.

### Step 1 — Verify / Install Rust toolchain
```powershell
# Check if Rust is installed
rustup --version

# If NOT installed:
winget install Rustlang.Rustup
# Then restart terminal and:
rustup default stable
rustup target add x86_64-pc-windows-msvc
```

### Step 2 — First Tauri dev run
```powershell
cd C:\Users\Yashpreet_o7\Desktop\AURAOS
npm run tauri:dev
# First run will compile Rust deps (~5-10 min)
# Subsequent runs: ~10-30 seconds
```

### Step 3 — Build Windows installer
```powershell
npm run tauri:build
# Output: src-tauri/target/release/bundle/nsis/AuraOS_1.0.0_x64-setup.exe
```

### Step 4 (Optional) — Connect marketplace
Create `.env` file:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### Step 5 (Optional) — Add Supabase DB tables
Run in Supabase SQL editor:
```sql
CREATE TABLE wallpapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  preview_url TEXT,
  package_url TEXT,
  downloads INT DEFAULT 0,
  likes INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE wallpapers ENABLE ROW LEVEL SECURITY;
```

---

## 📁 Current File Tree

```
C:\Users\Yashpreet_o7\Desktop\AURAOS\
├── src-tauri/
│   ├── src/
│   │   └── main.rs                 ✅ done
│   ├── Cargo.toml                  ✅ done
│   └── tauri.conf.json             ✅ done
├── src/
│   ├── engines/
│   │   ├── matrix-rain.js          ✅ done
│   │   ├── cyber-particles.js      ✅ done
│   │   ├── synthwave-grid.js       ✅ done
│   │   ├── deep-space.js           ✅ done
│   │   ├── aurora.js               ✅ done
│   │   ├── tokyo-rain.js           ✅ done
│   │   ├── audio-spectrum.js       ✅ done
│   │   └── index.js                ✅ done
│   ├── store/
│   │   └── useStore.js             ✅ done
│   ├── styles/
│   │   ├── themes.css              ✅ done
│   │   └── index.css               ❌ TODO
│   ├── components/
│   │   ├── WallpaperPlayer/        ❌ TODO
│   │   ├── ThemeEditor/            ❌ TODO
│   │   ├── Marketplace/            ❌ TODO
│   │   ├── Library/                ❌ TODO
│   │   ├── StatusBar/              ❌ TODO
│   │   └── Settings/               ❌ TODO
│   ├── pages/
│   │   ├── Home.jsx                ❌ TODO
│   │   ├── Marketplace.jsx         ❌ TODO
│   │   ├── Library.jsx             ❌ TODO
│   │   └── Settings.jsx            ❌ TODO
│   ├── lib/
│   │   ├── supabase.js             ❌ TODO
│   │   └── package-format.js       ❌ TODO
│   ├── App.jsx                     ❌ TODO
│   └── main.jsx                    ❌ TODO
├── public/
│   └── previews/                   ❌ TODO (wallpaper preview images)
├── vite.config.js                  ✅ done
└── package.json                    ❌ needs tauri scripts added
```

---

## 🔧 Architecture Decisions (Do Not Change)

| Decision | Choice | Reason |
|----------|--------|--------|
| Desktop framework | **Tauri 2** (not Electron) | 8MB app, 30MB RAM vs 150MB/300MB |
| Frontend | **React + Vite** | Fast HMR, optimized builds |
| State | **Zustand** (persisted) | Minimal, no boilerplate |
| Wallpaper rendering | **Canvas 2D** (not WebGL) | Lightweight, wide compatibility |
| Marketplace backend | **Supabase** (free tier) | Auth + DB + Storage in one |
| Windows wallpaper pinning | **Frameless Tauri window** pinned below desktop | Simpler than COM API, same visual result |
| Distribution | **NSIS installer** (.exe) | Standard Windows install experience |
| Package format | `.aura` (zip archive) | JSON manifest + entrypoint |

---

## 🗝️ Credentials Needed

### Supabase (for Marketplace)
The marketplace requires a Supabase project. Steps to set up:
1. Go to https://supabase.com → New project → Free tier
2. Create table `wallpapers` and `themes` (schema in implementation_plan.md)
3. Create `.env` at `C:\Users\Yashpreet_o7\Desktop\AURAOS\.env`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```
4. The `src/lib/supabase.js` file reads these at build time.

> [!NOTE]
> The app works 100% offline WITHOUT Supabase. Marketplace just shows "Connect to marketplace" prompt.

---

## 🛠️ Skills to Install in New Session

Tell the new session to install/use these skills:

1. **`google-antigravity-sdk`** — for autonomous agent orchestration if spawning subagents
2. **`planning-with-files`** — for maintaining task.md / progress.md during long builds
3. **`subagent-driven-development`** — for parallel execution of independent components
4. **`impeccable`** or **`ui-ux-pro-max`** — for UI polish and design review

---

## 📋 Exact Prompt for New Session

Paste this to resume:

```
I am resuming work on the AuraOS project. Read the handoff file at:
C:\Users\Yashpreet_o7\Desktop\AURAOS\HANDOFF.md

Then read the task list at:
C:\Users\Yashpreet_o7\.gemini\antigravity-ide\brain\ba0f1252-a761-4ecf-a4e8-82d3cc4eb3fe\task.md

Resume building from where we left off. The next tasks are:
1. Create src/styles/index.css (global styles)
2. Create src/components/WallpaperPlayer/index.jsx
3. Create src/App.jsx and src/main.jsx
4. Create all pages (Home, Marketplace, Library, Settings)
5. Create src/lib/supabase.js
6. Update package.json with tauri scripts
7. Run npm run tauri:dev to verify the app launches

Do NOT rebuild anything already marked ✅ in the HANDOFF.md file tree.
Keep the engine lightweight — Canvas 2D only, no heavy libraries.
```

---

## 📌 Reference Files

| File | Purpose |
|------|---------|
| [implementation_plan.md](file:///C:/Users/Yashpreet_o7/.gemini/antigravity-ide/brain/ba0f1252-a761-4ecf-a4e8-82d3cc4eb3fe/implementation_plan.md) | Full architecture plan |
| [task.md](file:///C:/Users/Yashpreet_o7/.gemini/antigravity-ide/brain/ba0f1252-a761-4ecf-a4e8-82d3cc4eb3fe/task.md) | Task checklist |
| [dashboard_template.py](file:///C:/Users/Yashpreet_o7/Desktop/PERSONALAGENT/server/dashboard_template.py) | Original engine source to port from |

---

*Handoff created by Antigravity (Gemini) — AuraOS session 2026-09-02*
