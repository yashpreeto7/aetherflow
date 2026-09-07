# GEMINI.md — Gemini-Specific Instructions for AetherFlow

<!-- This file is automatically read by Gemini at the start of every session. -->
<!-- It supplements AGENTS.md with Gemini-specific behavioral rules. -->

---

## MANDATORY SESSION START SEQUENCE

Every single time you start a session in this workspace, you MUST do ALL of these steps **before writing any code**:

### 1. Read CONTEXT.md (fastest way to get full project state)
```
Read the file: C:\Users\Yashpreet_o7\Desktop\AetherFlow\CONTEXT.md
```
This gives you the current build status, what's done, what's not done, and next action.

### 2. Read AGENTS.md
```
Read the file: C:\Users\Yashpreet_o7\Desktop\AetherFlow\AGENTS.md
```
Full project context, file structure, rules, step-by-step instructions.

### 3. Read REMAINING_TASKS.md
```
Read the file: C:\Users\Yashpreet_o7\Desktop\AetherFlow\REMAINING_TASKS.md
```
Pick up the first unchecked task.

### 4. Run the build
```powershell
cd C:\Users\Yashpreet_o7\Desktop\AetherFlow
npm run build
```
- ✅ If "built in Xms" → healthy, proceed
- ❌ If errors → fix before anything else

---

## MANDATORY SESSION END SEQUENCE

Before you stop working (whether done or just pausing), you MUST:

### 1. Run context-sync skill
The `context-sync` skill tells you exactly what to update. Follow all its steps.

### 2. Update CONTEXT.md
- Change "Last Updated" timestamp
- Update Build Status table
- Move completed files from ❌ to ✅
- Update "Next Immediate Action"
- Append to Session Log table

### 3. Update REMAINING_TASKS.md checkboxes
Change `[ ]` to `[x]` for anything you completed.

### 4. Append to SESSION_LOG.md
```markdown
---
## Session: [DATE] [TIME]
- **Agent:** [your model name]
- **Completed:** [list what you did]
- **Build status:** ✅ / ❌
- **Next session should:** [first unchecked task]
---
```

### 5. Final build check
```powershell
npm run build
```
Record the result.

---


## Gemini Behavioral Rules

### Always execute autonomously
- Do NOT ask "Should I proceed?" — just do it
- Do NOT ask "Is this correct?" — verify it yourself by running the build
- Do NOT stop and wait for confirmation between steps
- Run `npm run build` after every significant change to self-verify

### Never skip the build check
After any file edit, run:
```powershell
npm run build
```
If it fails, fix it. Do not move to the next task until the build passes.

### One task at a time
Do not try to implement multiple features at once. Pick the first unchecked item in `REMAINING_TASKS.md`, complete it fully, verify it, mark it done, then move to the next.

### When you are confused about the tech stack
Read `AGENTS.md` section "The Tech Stack (DO NOT CHANGE THESE)". The answers are there.

### When you hit an error you don't recognize
Read `AGENTS.md` section "Common Errors and How to Fix Them". It lists the most common problems.

### When you don't know what to do next
Read `REMAINING_TASKS.md`. It has exact step-by-step instructions.

---

## The 5 Things You Must Never Do

1. **Never use WebGL** — Canvas 2D only: `canvas.getContext('2d')` not `getContext('webgl')`
2. **Never call supabase without `isOnline()` check** — the app must work offline
3. **Never hardcode colors** — use `var(--color-brand)` not `#3b82f6`
4. **Never change `minify` to `'esbuild'`** — use `'oxc'` (Vite 8)
5. **Never make `manualChunks` an object** — must be a function (rolldown)

---

## Updating Status Files

After completing a task, update `HANDOFF.md`:
- Change a `❌ TODO` to `✅ Done` in the file tree section
- Update the status emoji at the top (🟡 → ✅ when all tasks done)

After completing ALL remaining tasks, change the top of `HANDOFF.md` to:
```
> **Status:** ✅ COMPLETE — All features implemented and tested
```

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server at http://localhost:1420/ |
| `npm run build` | Build frontend (verify no errors) |
| `npm run tauri:dev` | Run as native Windows app (needs Rust) |
| `npm run tauri:build` | Build Windows .exe installer |
| `rustup --version` | Check if Rust is installed |
| `winget install Rustlang.Rustup` | Install Rust on Windows |

| File | What to do there |
|------|-----------------|
| `src/engines/index.js` | Add new wallpaper engine entries |
| `src/styles/themes.css` | Add new theme CSS blocks |
| `src/store/useStore.js` | Add new settings (also add to `partialize`) |
| `src/pages/Home.jsx` | Edit the main UI page |
| `REMAINING_TASKS.md` | See what needs to be done |
| `AGENTS.md` | Full project instructions |
