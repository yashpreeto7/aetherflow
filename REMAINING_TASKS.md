# REMAINING_TASKS.md — AuraOS Next Steps
<!-- Read AGENTS.md first. This file describes what is left to do. -->
<!-- Each task has EXACT commands to run, EXACT files to create/edit, and a verification step. -->

---

## Current Status: Frontend ✅ Complete | Native App ❌ Not Yet Launched

The React + Vite frontend is 100% done and builds successfully.
The only thing that remains is launching it as a real Windows desktop app using Tauri.

---

## TASK 1 — Install Rust and Launch Native Windows App

**What this does:** Converts the web UI into an actual `.exe` Windows app that lives in the taskbar.

**Estimated time:** 15–30 minutes (mostly waiting for Rust to download and compile)

### Step 1.1 — Check if Rust is already installed
```powershell
rustup --version
```
- If you see a version number (e.g. `rustup 1.27.0`) → skip to Step 1.3
- If you see an error "not recognized" → go to Step 1.2

### Step 1.2 — Install Rust
```powershell
winget install Rustlang.Rustup
```
**After it finishes:** Close PowerShell completely. Open a new PowerShell window. Then:
```powershell
rustup default stable
rustup target add x86_64-pc-windows-msvc
```

### Step 1.3 — Verify Rust works
```powershell
rustc --version
cargo --version
```
Both should print version numbers. If not, restart your terminal and try again.

### Step 1.4 — Run AuraOS as a native Windows app (first time)
```powershell
cd C:\Users\Yashpreet_o7\Desktop\AURAOS
npm run tauri:dev
```
**IMPORTANT:** The first run downloads and compiles many Rust packages. This takes **5–10 minutes**. Do not cancel it. You will see lots of "Compiling..." messages — this is normal.

When it's done, a real Windows application window will open with the AuraOS UI.

### Step 1.5 — Verify it works
- [ ] A Windows app window opens (not a browser tab)
- [ ] The sidebar shows: Home, Marketplace, Library, Settings
- [ ] Clicking a wallpaper on the Home page activates it
- [ ] The status bar at the bottom shows FPS counter

### Step 1.6 — Update HANDOFF.md
Change the status line at the top of `HANDOFF.md` from:
```
> **Status:** 🟡 FRONTEND COMPLETE
```
To:
```
> **Status:** ✅ NATIVE APP RUNNING — ready for packaging
```

---

## TASK 2 — Generate Wallpaper Preview Images

**What this does:** Creates thumbnail `.webp` images for each wallpaper so they show up in the marketplace and library cards instead of "Preview unavailable".

**Estimated time:** 10 minutes

### Step 2.1 — Create the previews directory
```powershell
mkdir C:\Users\Yashpreet_o7\Desktop\AURAOS\public\previews 2>$null
```

### Step 2.2 — Generate placeholders
Since we can't auto-screenshot Canvas animations, create colored placeholder images.

Create the file `C:\Users\Yashpreet_o7\Desktop\AURAOS\scripts\generate-previews.html`:
```html
<!DOCTYPE html>
<html>
<body>
<canvas id="c" width="320" height="180"></canvas>
<script>
const previews = [
  { id: 'matrix-rain',      bg: '#000000', accent: '#00ff41', label: 'Matrix Rain' },
  { id: 'cyber-particles',  bg: '#030a0f', accent: '#00d4ff', label: 'Cyber Particles' },
  { id: 'synthwave-grid',   bg: '#0d0019', accent: '#ff2d78', label: 'Synthwave Grid' },
  { id: 'deep-space',       bg: '#000005', accent: '#8800cc', label: 'Deep Space' },
  { id: 'tokyo-rain',       bg: '#0a001a', accent: '#b400ff', label: 'Tokyo Rain' },
  { id: 'aurora',           bg: '#000810', accent: '#00ff88', label: 'Aurora' },
  { id: 'audio-spectrum',   bg: '#050010', accent: '#ff2d78', label: 'Audio Spectrum' },
]
const c = document.getElementById('c')
const ctx = c.getContext('2d')

previews.forEach(p => {
  ctx.fillStyle = p.bg
  ctx.fillRect(0, 0, 320, 180)
  const g = ctx.createRadialGradient(160, 90, 10, 160, 90, 120)
  g.addColorStop(0, p.accent + '44')
  g.addColorStop(1, 'transparent')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 320, 180)
  ctx.fillStyle = p.accent
  ctx.font = 'bold 16px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(p.label, 160, 95)
  const link = document.createElement('a')
  link.download = p.id + '.png'
  link.href = c.toDataURL()
  link.click()
})
</script>
</body>
</html>
```

Open this HTML file in a browser. It will download 7 PNG files. Move them to `public/previews/` and rename with `.webp` extension (or keep `.png` and update the paths in `src/engines/index.js` from `.webp` to `.png`).

### Step 2.3 — Update preview paths in engine registry
If you saved them as `.png`, open `src/engines/index.js` and change all `preview:` entries:
```js
// Change this:
preview: '/previews/matrix-rain.webp',
// To this:
preview: '/previews/matrix-rain.png',
```

### Step 2.4 — Verify
Run `npm run dev`, open http://localhost:1420/, go to Home page.
The wallpaper cards should now show colored preview images instead of blank areas.

---

## TASK 3 — Connect Marketplace (Optional, needs internet)

**What this does:** Enables the Marketplace page to actually load and publish community wallpapers. Without this, the Marketplace works in "offline mode" showing only built-in wallpapers.

**Estimated time:** 20 minutes

### Step 3.1 — Create Supabase account
1. Go to https://supabase.com
2. Click "Start your project" → sign up with GitHub or email
3. Create a new project (choose a region close to India, e.g. ap-south-1)
4. Wait for project to initialize (~2 minutes)

### Step 3.2 — Get your credentials
In Supabase dashboard:
1. Click "Settings" (gear icon, left sidebar)
2. Click "API"
3. Copy "Project URL" and "anon public" key

### Step 3.3 — Create .env file
Create the file `C:\Users\Yashpreet_o7\Desktop\AURAOS\.env`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...your_anon_key...
```
Replace the values with what you copied from Supabase.

### Step 3.4 — Create database tables
In Supabase dashboard, click "SQL Editor", then run this:
```sql
-- Wallpapers table
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

-- Security: anyone can read, only authors can insert their own
ALTER TABLE wallpapers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON wallpapers FOR SELECT USING (true);
CREATE POLICY "Auth insert" ON wallpapers FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Storage bucket for files
INSERT INTO storage.buckets (id, name, public) VALUES ('wallpapers', 'wallpapers', true);

-- Function for incrementing likes
CREATE OR REPLACE FUNCTION increment_likes(row_id UUID)
RETURNS void AS $$
  UPDATE wallpapers SET likes = likes + 1 WHERE id = row_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

### Step 3.5 — Verify
```powershell
cd C:\Users\Yashpreet_o7\Desktop\AURAOS
npm run dev
```
Open http://localhost:1420/marketplace — the "Offline" badge should disappear. You should see "Featured" wallpapers (empty at first, which is correct).

---

## TASK 4 — Build Windows Installer (Final Step)

**What this does:** Creates a `.exe` installer file anyone can double-click to install AuraOS.

**Requirements:** Rust must be installed (Task 1 must be complete).

### Step 4.1 — Build the installer
```powershell
cd C:\Users\Yashpreet_o7\Desktop\AURAOS
npm run tauri:build
```
This takes 3–10 minutes. You'll see Rust compilation output.

### Step 4.2 — Find the installer
The installer will be at:
```
C:\Users\Yashpreet_o7\Desktop\AURAOS\src-tauri\target\release\bundle\nsis\AuraOS_1.0.0_x64-setup.exe
```

### Step 4.3 — Verify
Double-click the `.exe` to install AuraOS. It should install and launch normally.

---

## TASK 5 — Future Feature: Theme Editor (Not Started)

This is a visual editor where users can customize theme colors with color pickers.

**Where to add it:** Create `src/components/ThemeEditor/index.jsx`

**What it should do:**
1. Show color pickers for each CSS custom property (`--color-brand`, `--color-accent`, etc.)
2. Live-preview changes by calling `document.documentElement.style.setProperty('--color-brand', newColor)`
3. Save the custom theme to the Zustand store via `useStore.getState().saveCustomTheme(id, tokens)`
4. Show a "Save Theme" button that names the theme
5. Add the saved theme to the themes list on the Home page

**Do NOT start this task until Tasks 1–3 are complete.**

---

## TASK 6 — Future Feature: Video Wallpaper Support (Not Started)

Allow users to use a local MP4/WebM video file as a wallpaper.

**Where to add it:** Create `src/engines/video-player.js`

**What it should do:**
1. Accept a `videoPath` in options (local file path or URL)
2. Use an `<video>` element (NOT canvas) positioned behind all other windows
3. Set `video.loop = true`, `video.muted = true`, `video.autoplay = true`
4. Add a `pause()` method called when `pauseOnBattery` or `pauseOnFullscreen` is active

**Note:** This will need a new Tauri command in `src-tauri/src/main.rs` to access local files.

---

## Completion Checklist

Mark these off as you complete them:

- [x] TASK 1: Rust installed + `npm run tauri:dev` works → native window opens
- [x] TASK 2: Preview images exist in `public/previews/` → cards show thumbnails
- [x] TASK 3: `.env` created + Supabase tables created → marketplace is live
- [x] TASK 4: `npm run tauri:build` → installer .exe created
- [x] TASK 5: Theme editor built
- [x] TASK 6: Video wallpaper support (with MPV hardware acceleration)
- [x] TASK 7: FPS throttle pacing + FPS Benchmark HUD Wallpaper
- [x] TASK 8: Pruned repository (removed `.agents/` tracking, unused assets, and debug binaries)
- [x] TASK 9: Native Win32 Translucent Taskbar (Clear, Acrylic, Blur, Default)
- [x] TASK 10: YouTube & Live Web Stream Wallpapers (embedded iframes + instant thumbnails)
- [x] TASK 11: In-App GitHub Releases Auto-Updater (Settings check + startup toast notification)
- [x] TASK 12: Community Marketplace Backend & Live Database Migration (Supabase RPCs, 20-wallpaper catalog, real-time likes & installs, Staff Pick curation, My Submissions)
