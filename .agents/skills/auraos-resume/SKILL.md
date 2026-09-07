---
name: auraos-resume
description: "AuraOS project context loader. ALWAYS use this at the start of any AuraOS session. Loads full project state, file tree, architecture, what's done and what's left. Trigger on: 'resume', 'continue building', 'where did we leave off', 'pick up', session start on AuraOS workspace, or any AuraOS build task."
user-invocable: true
---

# AuraOS Resume Skill

## STEP 1: Read these files RIGHT NOW (in this order)

Do not skip any of these. Read each file completely before proceeding.

### File 1: HANDOFF.md
Location: `C:\Users\Yashpreet_o7\Desktop\AetherFlow\HANDOFF.md`

This file tells you:
- Current build status (is it 🟡 in progress or ✅ complete?)
- What files are done (✅) and what is not done (❌)
- What the next thing to work on is

### File 2: REMAINING_TASKS.md
Location: `C:\Users\Yashpreet_o7\Desktop\AetherFlow\REMAINING_TASKS.md`

This file tells you:
- Exact step-by-step instructions for each remaining task
- Which task to do first
- How to verify each task is complete

### File 3: AGENTS.md
Location: `C:\Users\Yashpreet_o7\Desktop\AetherFlow\AGENTS.md`

This file tells you:
- Full file structure
- Rules you must follow
- How to add new engines and themes
- Common errors and fixes

---

## STEP 2: Verify the build works

Run this command:
```powershell
cd C:\Users\Yashpreet_o7\Desktop\AetherFlow
npm run build
```

**Expected output** (success):
```
✓ built in ~400ms
```

**If you see errors:** Fix the errors before doing anything else. The most common errors are listed in `AGENTS.md` under "Common Errors and How to Fix Them".

---

## STEP 3: Start the dev server and visually confirm the UI works

```powershell
npm run dev
```

Open http://localhost:1420/ in a browser. You should see:
- A dark sidebar on the left with: Home, Marketplace, Library, Settings
- The Home page with a wallpaper grid showing 7 animated canvas previews
- A status bar at the bottom showing "No wallpaper · sovereign onyx · X fps"

If the page is blank or has JavaScript errors, something is broken — fix before proceeding.

---

## STEP 4: Pick the first unchecked task from REMAINING_TASKS.md

Look at the "Completion Checklist" at the bottom of `REMAINING_TASKS.md`. Pick the first `[ ]` unchecked item. Follow its step-by-step instructions exactly.

---

## Project Quick Reference (memorize this)

**What is AuraOS?**
A standalone Windows desktop wallpaper + theme engine. Like Wallpaper Engine but free and open source.

**Where is it?**
`C:\Users\Yashpreet_o7\Desktop\AetherFlow\`
(NOT in PERSONALAGENT — that's a different project, don't touch it)

**Tech stack:**
- Tauri 2 (Rust backend) — makes it a real Windows app
- React 19 + Vite 8 — the UI
- Zustand — state management (persisted to localStorage)
- Supabase — marketplace backend (optional, offline-safe)
- Canvas 2D — wallpaper animations (NO WebGL)

**The 3 most important rules:**
1. Canvas 2D only — never `getContext('webgl')`
2. Check `isOnline()` before any Supabase call
3. Run `npm run build` after every significant change

**Key npm scripts:**
- `npm run dev` → starts at http://localhost:1420/
- `npm run build` → verifies everything compiles
- `npm run tauri:dev` → opens as real Windows app (needs Rust)
- `npm run tauri:build` → makes the .exe installer

**Current status:**
Frontend is 100% done. Next step is installing Rust and running `npm run tauri:dev`.
See `REMAINING_TASKS.md` Task 1 for exact instructions.
