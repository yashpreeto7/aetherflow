# AGENTS.md — AuraOS AI Agent Instructions
<!-- This file is automatically read by ALL AI agents (Gemini, Claude, GPT, Codex, etc.) -->
<!-- Written to be maximally explicit. Assume the agent has NO prior context. -->

---

## 🚨 READ THIS ENTIRE FILE BEFORE DOING ANYTHING 🚨

---

## What This Project Is

**AuraOS** is a standalone Windows desktop application. Think of it like "Wallpaper Engine" — it shows live animated wallpapers on the Windows desktop and lets users switch themes.

It is **NOT** part of the Personal AI OS project. It lives here:
```
C:\Users\Yashpreet_o7\Desktop\AURAOS\
```

The Personal AI OS is at:
```
C:\Users\Yashpreet_o7\Desktop\PERSONALAGENT\   ← DO NOT TOUCH THIS
```

---

## Step 1: Always Do This First (Every Single Session)

Run these commands **in order** before writing a single line of code:

```powershell
# 1. Go to the project folder
cd C:\Users\Yashpreet_o7\Desktop\AURAOS

# 2. Read the handoff file to know current status
# (Open and read HANDOFF.md in this folder)

# 3. Verify the build still works
npm run build

# 4. Start the dev server to visually check the UI
npm run dev
# Then open http://localhost:1420/ in a browser
```

If `npm run build` **fails**, fix those errors BEFORE doing anything else.
If `npm run build` **succeeds**, proceed to the remaining tasks in HANDOFF.md.

---

## The Tech Stack (DO NOT CHANGE THESE)

| Thing | What it is | Why |
|-------|-----------|-----|
| **Tauri 2** | The desktop app framework (Rust backend) | Lightweight: 8MB app, 30MB RAM |
| **React 19** | The UI framework | Components, routing |
| **Vite 8** | The build tool | Fast HMR dev server |
| **Zustand** | Global state management | Simple, no boilerplate |
| **Supabase** | Cloud backend for marketplace | Free tier: auth + database + storage |
| **Canvas 2D** | How wallpapers are drawn | Lightweight, no GPU required |

> ❌ DO NOT switch to Electron (too heavy — 150MB+)
> ❌ DO NOT use WebGL or Three.js (Canvas 2D only)
> ❌ DO NOT use Tailwind CSS (vanilla CSS custom properties only)
> ❌ DO NOT install new heavy npm packages without a very good reason

---

## The File Structure

Here is every important file and what it does:

```
AURAOS/
│
├── AGENTS.md               ← You are reading this
├── GEMINI.md               ← Extra rules auto-loaded by Gemini
├── HANDOFF.md              ← Current build status + what's done/remaining
│
├── index.html              ← HTML entry point (do not change much)
├── vite.config.js          ← Vite configuration (do not change)
├── package.json            ← npm scripts and dependencies
│
├── src-tauri/              ← Rust backend (the native Windows app shell)
│   ├── Cargo.toml          ← Rust dependencies
│   ├── tauri.conf.json     ← App name, window size, tray icon, installer
│   └── src/
│       └── main.rs         ← Rust entry point: window management commands
│
└── src/                    ← React frontend (the UI you see)
    ├── main.jsx            ← React app entry point
    ├── App.jsx             ← Main layout: sidebar + router + wallpaper layer
    │
    ├── styles/
    │   ├── index.css       ← Global CSS: reset, card, button, slider, toggle utilities
    │   └── themes.css      ← All 6 theme definitions as CSS custom properties
    │
    ├── engines/            ← Wallpaper animation engines
    │   ├── index.js        ← Registry of all engines (add new engines here)
    │   ├── matrix-rain.js
    │   ├── cyber-particles.js
    │   ├── synthwave-grid.js
    │   ├── deep-space.js
    │   ├── aurora.js
    │   ├── tokyo-rain.js
    │   └── audio-spectrum.js
    │
    ├── store/
    │   └── useStore.js     ← All global state (Zustand, persisted to localStorage)
    │
    ├── lib/
    │   └── supabase.js     ← Marketplace API (works offline if no .env file)
    │
    ├── components/
    │   ├── WallpaperPlayer/
    │   │   └── index.jsx   ← Renders a wallpaper engine on a <canvas>
    │   └── StatusBar/
    │       └── index.jsx   ← Bottom bar showing wallpaper name, FPS, theme
    │
    └── pages/
        ├── Home.jsx        ← Main page: wallpaper grid, controls, theme switcher
        ├── Marketplace.jsx ← Browse/search/publish wallpapers
        ├── Library.jsx     ← Installed wallpapers and themes
        └── Settings.jsx    ← FPS cap, audio, glassmorphism, startup settings
```

---

## The Rules You Must Never Break

### Rule 1: Canvas 2D Only for Wallpaper Engines
Every file in `src/engines/` MUST:
- Use `canvas.getContext('2d')` — NOT `getContext('webgl')`
- Use `requestAnimationFrame` for animation loops
- Export a factory function named `create<EngineName>(canvas, options)`
- Return an object with exactly these three methods: `{ start, stop, updateOptions }`
- Call `cancelAnimationFrame` inside `stop()` to prevent memory leaks
- Call `window.removeEventListener('resize', resize)` inside `stop()`
- Be under 5KB in file size

### Rule 2: Offline-Safe Supabase
Every time you call Supabase, check `isOnline()` first:
```js
// ✅ CORRECT
import { supabase, isOnline } from '../lib/supabase.js'
if (!isOnline()) return []
const { data } = await supabase.from('wallpapers').select('*')

// ❌ WRONG — will crash if no Supabase credentials
const { data } = await supabase.from('wallpapers').select('*')
```

### Rule 3: Zustand Persist
When you add a new setting to `useStore.js`, you MUST also add it to the `partialize` array at the bottom of the store, otherwise it won't be saved between app restarts.

### Rule 4: Theme Switching
Themes work by setting `document.documentElement.setAttribute('data-theme', themeId)`.
All theme colors are CSS custom properties in `src/styles/themes.css`.
Do NOT hardcode any colors in components — always use `var(--color-brand)` etc.

### Rule 5: Vite 8 Specific
- Use `minify: 'oxc'` (NOT `'esbuild'` — Vite 8 removed it)
- `manualChunks` must be a **function**, not an object (rolldown requirement)

---

## What Is Already Built (DO NOT REBUILD)

The frontend is 100% complete. These files exist and work:

| File | Status |
|------|--------|
| `src/engines/*.js` (all 7) | ✅ Done |
| `src/engines/index.js` | ✅ Done |
| `src/store/useStore.js` | ✅ Done |
| `src/styles/index.css` | ✅ Done |
| `src/styles/themes.css` | ✅ Done |
| `src/components/WallpaperPlayer/index.jsx` | ✅ Done |
| `src/components/StatusBar/index.jsx` | ✅ Done |
| `src/lib/supabase.js` | ✅ Done |
| `src/pages/Home.jsx` | ✅ Done |
| `src/pages/Marketplace.jsx` | ✅ Done |
| `src/pages/Library.jsx` | ✅ Done |
| `src/pages/Settings.jsx` | ✅ Done |
| `src/App.jsx` | ✅ Done |
| `src/main.jsx` | ✅ Done |
| `src-tauri/src/main.rs` | ✅ Done |
| `src-tauri/Cargo.toml` | ✅ Done |
| `src-tauri/tauri.conf.json` | ✅ Done |
| `vite.config.js` | ✅ Done |
| `package.json` | ✅ Done |

---

## What Still Needs To Be Done

Read `REMAINING_TASKS.md` in this folder. It has step-by-step instructions for each task.

The tasks in priority order:
1. Install Rust and run `npm run tauri:dev` to get a native Windows window
2. Generate preview images for the wallpapers
3. (Optional) Create Supabase project and add `.env` file for marketplace

---

## How to Add a New Wallpaper Engine (Step by Step)

If you are adding a new engine, follow these exact steps:

**Step 1:** Create `src/engines/my-engine.js`:
```js
export function createMyEngine(canvas, options = {}) {
  const { color = '#ffffff', speedMultiplier = 1 } = options
  const ctx = canvas.getContext('2d')  // MUST be '2d', not 'webgl'
  let animId = null

  function resize() {
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
  }

  function frame() {
    // Draw your animation here
    // Example: ctx.fillRect(0, 0, canvas.width, canvas.height)
    animId = requestAnimationFrame(frame)
  }

  function start() {
    resize()
    window.addEventListener('resize', resize)
    animId = requestAnimationFrame(frame)
  }

  function stop() {
    if (animId) cancelAnimationFrame(animId)  // MUST DO THIS
    window.removeEventListener('resize', resize)  // MUST DO THIS
  }

  function updateOptions(newOpts) {
    Object.assign(options, newOpts)
  }

  return { start, stop, updateOptions }
}
```

**Step 2:** Add it to `src/engines/index.js`:
```js
'my-engine': {
  id: 'my-engine',
  name: 'My Engine Name',
  description: 'One sentence description',
  preview: '/previews/my-engine.webp',
  tags: ['tag1', 'tag2'],
  defaultConfig: { color: '#ffffff', speedMultiplier: 1 },
  properties: {
    color: { type: 'color', label: 'Color', default: '#ffffff' },
  },
  load: () => import('./my-engine.js').then(m => m.createMyEngine),
},
```

**Step 3:** Run `npm run build` to verify no errors.

---

## How to Add a New Theme (Step by Step)

**Step 1:** Add a CSS block to `src/styles/themes.css`:
```css
[data-theme="my-theme"] {
  --rgb-base:       10, 10, 10;
  --rgb-sidebar:    20, 20, 20;
  --rgb-card:       30, 30, 30;
  --rgb-card-hover: 40, 40, 40;

  --bg-base:         rgb(var(--rgb-base));
  --bg-sidebar:      rgba(var(--rgb-sidebar), var(--sidebar-opacity));
  --bg-card:         rgba(var(--rgb-card), var(--card-opacity));
  --bg-card-hover:   rgba(var(--rgb-card-hover), calc(var(--card-opacity) + 0.08));

  --border-main:     #333333;
  --border-accent:   #your-accent-color;
  --color-brand:     #your-brand-color;
  --color-brand-hover: #your-brand-hover;
  --color-accent:    #your-accent;
  --color-highlight: #your-highlight;
  --color-cyan:      #your-cyan;
  --color-emerald:   #your-emerald;
  --color-amber:     #your-amber;
  --color-rose:      #your-rose;
  --color-purple:    #your-purple;

  --text-main:       #ffffff;
  --text-muted:      #888888;
  --text-subtle:     #555555;

  --glow-shadow:     0 4px 20px -2px rgba(0,0,0,0.35);
  --shadow-card:     0 1px 3px rgba(0,0,0,0.8);
  --shadow-card-hover: 0 0 0 1px var(--color-brand), 0 8px 24px rgba(0,0,0,0.3);
  --bevel-highlight: inset 0 1px 0 rgba(255,255,255,0.08);
}
```

**Step 2:** Add it to the `BUILTIN_THEMES` array in `src/engines/index.js`:
```js
{ id: 'my-theme', name: 'My Theme Name', accent: '#your-accent', bg: '#your-bg', category: 'dark' },
```

**Step 3:** Run `npm run build` to verify no errors.

---

## How to Run the App

### Option A: Frontend only (no Rust needed, fast)
```powershell
cd C:\Users\Yashpreet_o7\Desktop\AURAOS
npm run dev
# Open http://localhost:1420/ in your browser
```

### Option B: As a real Windows app (needs Rust installed)
```powershell
# First check if Rust is installed:
rustup --version

# If NOT installed, run:
winget install Rustlang.Rustup
# Close and reopen terminal, then:
rustup default stable
rustup target add x86_64-pc-windows-msvc

# Then run the app:
cd C:\Users\Yashpreet_o7\Desktop\AURAOS
npm run tauri:dev
# First run takes 5-10 minutes (compiling Rust). Subsequent runs: 10-30 seconds.
```

### Option C: Build the Windows installer (.exe)
```powershell
cd C:\Users\Yashpreet_o7\Desktop\AURAOS
npm run tauri:build
# Installer appears at: src-tauri\target\release\bundle\nsis\AuraOS_1.0.0_x64-setup.exe
```

---

## Common Errors and How to Fix Them

### Error: `manualChunks is not a function`
**Cause:** You changed `manualChunks` from a function to an object.
**Fix:** In `vite.config.js`, keep it as a function:
```js
// ✅ CORRECT
manualChunks(id) {
  if (id.includes('node_modules/react')) return 'react'
}

// ❌ WRONG
manualChunks: { react: ['react', 'react-dom'] }
```

### Error: `Cannot find package 'esbuild'`
**Cause:** You set `minify: 'esbuild'` in `vite.config.js`.
**Fix:** Change it to `minify: 'oxc'` (Vite 8 removed esbuild).

### Error: `supabase is null` or `Cannot read properties of null`
**Cause:** You called supabase without checking `isOnline()` first.
**Fix:** Add `if (!isOnline()) return []` before any supabase call.

### Error: Wallpaper engine keeps running after switching
**Cause:** You forgot to call `stop()` on the old engine before starting a new one.
**Fix:** The `WallpaperPlayer` component handles this — make sure you don't instantiate engines directly outside of it.

### Error: Theme colors not changing
**Cause:** You hardcoded a color instead of using a CSS custom property.
**Fix:** Replace hardcoded colors like `#3b82f6` with `var(--color-brand)`.

---

## The Marketplace (Optional Feature)

The marketplace is connected to Supabase. The app works fine WITHOUT Supabase — it just shows the built-in wallpapers.

To enable the marketplace:
1. Go to https://supabase.com and create a free account + new project
2. Create a file `C:\Users\Yashpreet_o7\Desktop\AURAOS\.env`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
3. In Supabase's SQL editor, run:
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
CREATE POLICY "Anyone can read" ON wallpapers FOR SELECT USING (true);
CREATE POLICY "Authors can insert" ON wallpapers FOR INSERT WITH CHECK (auth.uid() = author_id);
```
4. Run `npm run build` again.

---

## Quality Checklist (Run Before Finishing Any Task)

Before you say "I'm done", check every item:

- [ ] `npm run build` runs with zero errors
- [ ] `npm run dev` starts and http://localhost:1420/ opens without console errors
- [ ] The page you worked on renders visually (no blank white screen)
- [ ] Theme switching works (try clicking different themes on Home page)
- [ ] If you added a new engine: it renders on the canvas and `stop()` is called on unmount
- [ ] If you added new settings: they persist after page refresh (stored in localStorage)
- [ ] No hardcoded color values — only `var(--color-*)` CSS custom properties
- [ ] No unused imports at the top of files
- [ ] Update `HANDOFF.md` status if a whole task is complete

---

## Contact / Owner

This project is owned by Yashpreet. The original AI that set it up was Antigravity (Google Gemini).
If something seems broken, read `HANDOFF.md` first — it explains everything.
